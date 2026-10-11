import type {FileSystemTree, WebContainer} from '@webcontainer/api';
import {InMemoryFs} from 'just-bash/browser';
import type {
  BufferEncoding,
  CpOptions,
  FileContent,
  FsStat,
  IFileSystem,
  MkdirOptions,
  RmOptions,
} from 'just-bash/browser';

type WebContainerLike = Pick<WebContainer, 'export' | 'fs'>;

function splitPathSegments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function normalizeAbsolutePath(path: string, base: string = '/'): string {
  const sourceSegments = path.startsWith('/')
    ? splitPathSegments(path)
    : [...splitPathSegments(base), ...splitPathSegments(path)];
  const normalized: string[] = [];

  for (const segment of sourceSegments) {
    if (!segment || segment === '.') {
      continue;
    }
    if (segment === '..') {
      normalized.pop();
      continue;
    }
    normalized.push(segment);
  }

  return normalized.length === 0 ? '/' : `/${normalized.join('/')}`;
}

function joinAbsolutePath(base: string, segment: string): string {
  return normalizeAbsolutePath(segment, base);
}

function getParentPath(path: string): string {
  const normalized = normalizeAbsolutePath(path);
  if (normalized === '/') {
    return '/';
  }
  const segments = splitPathSegments(normalized);
  segments.pop();
  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
}

function isDirectoryNode(
  node: FileSystemTree[string],
): node is {directory: FileSystemTree} {
  return 'directory' in node;
}

function isSymlinkNode(
  node: FileSystemTree[string],
): node is {file: {symlink: string}} {
  return 'file' in node && 'symlink' in node.file;
}

async function loadTreeIntoFs(
  fs: InMemoryFs,
  tree: FileSystemTree,
  basePath: string = '/',
): Promise<void> {
  const pendingSymlinks: Array<{path: string; target: string}> = [];

  const visit = async (subtree: FileSystemTree, currentPath: string) => {
    for (const [name, entry] of Object.entries(subtree)) {
      const nextPath = joinAbsolutePath(currentPath, name);
      if (isDirectoryNode(entry)) {
        await fs.mkdir(nextPath, {recursive: true});
        await visit(entry.directory, nextPath);
        continue;
      }
      if (isSymlinkNode(entry)) {
        pendingSymlinks.push({path: nextPath, target: entry.file.symlink});
        continue;
      }
      await fs.writeFile(nextPath, entry.file.contents);
    }
  };

  await visit(tree, basePath);

  for (const symlink of pendingSymlinks) {
    await fs.symlink(symlink.target, symlink.path);
  }
}

export class WebContainerFsAdapter implements IFileSystem {
  private mirror = new InMemoryFs();

  constructor(private readonly webContainer: WebContainerLike) {}

  asFileSystem(): IFileSystem {
    return this;
  }

  async syncFromWebContainer(): Promise<void> {
    const nextMirror = new InMemoryFs();
    const exportedTree = await this.webContainer.export('.');
    await loadTreeIntoFs(nextMirror, exportedTree);
    this.mirror = nextMirror;
  }

  private resolveWithinRoot(base: string, path: string): string {
    return normalizeAbsolutePath(path, base);
  }

  private async ensureParentDirectory(path: string): Promise<void> {
    const parentPath = getParentPath(path);
    if (parentPath !== '/') {
      await this.webContainer.fs.mkdir(parentPath, {recursive: true});
    }
  }

  private async persistMirrorPath(path: string): Promise<void> {
    const stat = await this.mirror.lstat(path);
    if (stat.isSymbolicLink) {
      throw new Error(
        'WebContainer filesystem adapter does not support creating symlinks.',
      );
    }

    if (stat.isDirectory) {
      if (path !== '/') {
        await this.webContainer.fs.mkdir(path, {recursive: true});
      }
      const entries = await this.mirror.readdir(path);
      for (const entry of entries) {
        await this.persistMirrorPath(joinAbsolutePath(path, entry));
      }
      return;
    }

    await this.ensureParentDirectory(path);
    const contents = await this.mirror.readFileBuffer(path);
    await this.webContainer.fs.writeFile(path, contents);
  }

  async readFile(
    path: string,
    options?: {encoding?: BufferEncoding | null} | BufferEncoding,
  ): Promise<string> {
    const resolvedPath = this.resolveWithinRoot('/', path);
    return this.mirror.readFile(resolvedPath, options as BufferEncoding);
  }

  async readFileBuffer(path: string): Promise<Uint8Array> {
    const resolvedPath = this.resolveWithinRoot('/', path);
    return this.mirror.readFileBuffer(resolvedPath);
  }

  async writeFile(
    path: string,
    content: FileContent,
    options?: {encoding?: BufferEncoding} | BufferEncoding,
  ): Promise<void> {
    const resolvedPath = this.resolveWithinRoot('/', path);
    const encoding =
      typeof options === 'string' ? options : (options?.encoding ?? undefined);
    await this.ensureParentDirectory(resolvedPath);
    await this.webContainer.fs.writeFile(
      resolvedPath,
      content,
      encoding ? {encoding} : undefined,
    );
    await this.mirror.writeFile(resolvedPath, content, encoding);
  }

  async appendFile(
    path: string,
    content: FileContent,
    options?: {encoding?: BufferEncoding} | BufferEncoding,
  ): Promise<void> {
    const resolvedPath = this.resolveWithinRoot('/', path);
    await this.mirror.appendFile(
      resolvedPath,
      content,
      options as BufferEncoding,
    );
    try {
      await this.ensureParentDirectory(resolvedPath);
      const updatedContents = await this.mirror.readFileBuffer(resolvedPath);
      await this.webContainer.fs.writeFile(resolvedPath, updatedContents);
    } catch (error) {
      await this.syncFromWebContainer();
      throw error;
    }
  }

  async exists(path: string): Promise<boolean> {
    const resolvedPath = this.resolveWithinRoot('/', path);
    return this.mirror.exists(resolvedPath);
  }

  async stat(path: string): Promise<FsStat> {
    const resolvedPath = this.resolveWithinRoot('/', path);
    return this.mirror.stat(resolvedPath);
  }

  async mkdir(path: string, options?: MkdirOptions): Promise<void> {
    const resolvedPath = this.resolveWithinRoot('/', path);
    if (options?.recursive) {
      await this.webContainer.fs.mkdir(resolvedPath, {recursive: true});
    } else {
      await this.webContainer.fs.mkdir(resolvedPath);
    }
    await this.mirror.mkdir(resolvedPath, options);
  }

  async readdir(path: string): Promise<string[]> {
    const resolvedPath = this.resolveWithinRoot('/', path);
    return this.mirror.readdir(resolvedPath);
  }

  async rm(path: string, options?: RmOptions): Promise<void> {
    const resolvedPath = this.resolveWithinRoot('/', path);
    await this.webContainer.fs.rm(resolvedPath, {
      force: options?.force,
      recursive: options?.recursive,
    });
    await this.mirror.rm(resolvedPath, options);
  }

  async cp(src: string, dest: string, options?: CpOptions): Promise<void> {
    const resolvedSrc = this.resolveWithinRoot('/', src);
    const resolvedDest = this.resolveWithinRoot('/', dest);
    await this.mirror.cp(resolvedSrc, resolvedDest, options);
    try {
      await this.persistMirrorPath(resolvedDest);
    } catch (error) {
      await this.syncFromWebContainer();
      throw error;
    }
  }

  async mv(src: string, dest: string): Promise<void> {
    const resolvedSrc = this.resolveWithinRoot('/', src);
    const resolvedDest = this.resolveWithinRoot('/', dest);
    await this.ensureParentDirectory(resolvedDest);
    await this.webContainer.fs.rename(resolvedSrc, resolvedDest);
    await this.mirror.mv(resolvedSrc, resolvedDest);
  }

  resolvePath(base: string, path: string): string {
    return this.resolveWithinRoot(base, path);
  }

  getAllPaths(): string[] {
    return this.mirror.getAllPaths();
  }

  async chmod(path: string, mode: number): Promise<void> {
    const resolvedPath = this.resolveWithinRoot('/', path);
    await this.mirror.chmod(resolvedPath, mode);
  }

  async symlink(_target: string, _linkPath: string): Promise<void> {
    throw new Error(
      'WebContainer filesystem adapter does not support creating symlinks.',
    );
  }

  async link(_existingPath: string, _newPath: string): Promise<void> {
    throw new Error(
      'WebContainer filesystem adapter does not support creating hard links.',
    );
  }

  async readlink(path: string): Promise<string> {
    const resolvedPath = this.resolveWithinRoot('/', path);
    return this.mirror.readlink(resolvedPath);
  }

  async lstat(path: string): Promise<FsStat> {
    const resolvedPath = this.resolveWithinRoot('/', path);
    return this.mirror.lstat(resolvedPath);
  }

  async realpath(path: string): Promise<string> {
    const resolvedPath = this.resolveWithinRoot('/', path);
    return this.mirror.realpath(resolvedPath);
  }

  async utimes(path: string, atime: Date, mtime: Date): Promise<void> {
    const resolvedPath = this.resolveWithinRoot('/', path);
    await this.mirror.utimes(resolvedPath, atime, mtime);
  }
}
