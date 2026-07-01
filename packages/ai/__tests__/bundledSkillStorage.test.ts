import {
  BundledSkillStorage,
  SkillNotFoundError,
  SkillRootReadOnlyError,
} from '../src';

const root = {
  id: 'package:test',
  label: 'Test bundled skills',
  writable: false,
};

const skills = [
  {
    id: 'test-skill',
    manifest: {
      id: 'test-skill',
      version: '0.1.0',
      name: 'Test Skill',
      description: 'A bundled test skill.',
    },
    instructions: 'Use the test skill carefully.',
  },
];

describe('BundledSkillStorage', () => {
  it('lists and reads bundled skills from a read-only root', async () => {
    const storage = new BundledSkillStorage(root, skills);

    await expect(storage.listRoots()).resolves.toEqual([root]);
    await expect(storage.listSkills()).resolves.toEqual([
      {
        ref: {rootId: 'package:test', id: 'test-skill'},
        manifest: skills[0].manifest,
      },
    ]);
    await expect(
      storage.readSkill({rootId: 'package:test', id: 'test-skill'}),
    ).resolves.toMatchObject({
      ref: {rootId: 'package:test', id: 'test-skill'},
      instructions: 'Use the test skill carefully.',
    });
  });

  it('resolves bare ids within the bundled root', async () => {
    const storage = new BundledSkillStorage(root, skills);

    await expect(storage.resolveSkillId('test-skill')).resolves.toEqual({
      rootId: 'package:test',
      id: 'test-skill',
    });
    await expect(storage.resolveSkillId('missing')).resolves.toBeNull();
  });

  it('rejects reads and writes outside the bundled catalog', async () => {
    const storage = new BundledSkillStorage(root, skills);

    await expect(
      storage.readSkill({rootId: 'package:test', id: 'missing'}),
    ).rejects.toBeInstanceOf(SkillNotFoundError);
    await expect(
      storage.writeSkill('package:test', 'test-skill', {
        manifest: skills[0].manifest,
        instructions: 'Updated',
      }),
    ).rejects.toBeInstanceOf(SkillRootReadOnlyError);
  });
});
