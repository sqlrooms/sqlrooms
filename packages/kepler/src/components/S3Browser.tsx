import React, {useState, useCallback} from 'react';
import {S3Client} from '@aws-sdk/client-s3';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import * as z from 'zod';

import {
  listFilesAndDirectoriesWithPrefix,
  deleteS3Files,
  S3FileBrowser,
} from '@sqlrooms/s3-browser';
import {
  Input,
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@sqlrooms/ui';
import {
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  Download,
  RefreshCw,
  ArrowUp,
} from 'lucide-react';

// Initialize S3 client
const s3Client = new S3Client({
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'YOUR_ACCESS_KEY_ID',
    secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
    sessionToken: 'YOUR_SESSION_TOKEN', // <-- required if you're using temporary credentials
  },
});
const S3_REGIONS = [
  {value: 'us-east-1', label: 'us-east-1'},
  {value: 'us-east-2', label: 'us-east-2'},
  {value: 'us-west-1', label: 'us-west-1'},
  {value: 'us-west-2', label: 'us-west-2'},
  {value: 'eu-west-1', label: 'eu-west-1'},
  {value: 'eu-central-1', label: 'eu-central-1'},
  {value: 'ap-northeast-1', label: 'ap-northeast-1'},
  {value: 'ap-southeast-1', label: 'ap-southeast-1'},
];
// List files and directories
async function listFiles(S3Client, bucketName, prefix) {
  const files = await listFilesAndDirectoriesWithPrefix(
    s3Client,
    bucketName,
    '',
  );
  console.log(files);
}
const formSchema = z.object({
  accessKeyId: z.string().min(1, 'Required'),
  secretAccessKey: z.string().min(1, 'Required'),
  region: z.string().min(1, 'Required'),
  bucket: z.string().min(1, 'Required'),
});

export const S3Browser = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState([]);
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      accessKeyId: '',
      secretAccessKey: '',
      region: 'us-east-1',
      bucket: '',
    },
  });
  // Mock function for connecting to S3
  // const connectToS3 = () => {
  //   setIsLoading(true);
  //   setError('');

  //   // Simulate API call
  //   setTimeout(() => {
  //     if (!bucketName || !accessKey || !secretKey) {
  //       setError('Please fill in all required fields');
  //       setIsLoading(false);
  //       return;
  //     }

  //     // In a real implementation, this would connect to AWS SDK
  //     setIsConnected(true);
  //     setIsLoading(false);
  //     loadItems('/');
  //   }, 1000);
  // };

  // Mock function to load items from the current path
  // const loadItems = (path) => {
  //   setIsLoading(true);
  //   setCurrentPath(path);

  //   // Simulate API call to S3
  //   setTimeout(() => {
  //     // Mock data - in a real app, this would come from AWS SDK
  //     const mockItems = generateMockItems(path);
  //     setItems(mockItems);
  //     setIsLoading(false);
  //   }, 800);
  // };

  // Generate mock items based on the path
  const generateMockItems = (path) => {
    if (path === '/') {
      return [
        {name: 'images', type: 'folder', path: '/images/'},
        {name: 'documents', type: 'folder', path: '/documents/'},
        {
          name: 'readme.txt',
          type: 'file',
          size: '2.3 KB',
          lastModified: '2025-05-01',
        },
        {
          name: 'config.json',
          type: 'file',
          size: '4.7 KB',
          lastModified: '2025-05-10',
        },
      ];
    } else if (path === '/images/') {
      return [
        {name: 'profile', type: 'folder', path: '/images/profile/'},
        {
          name: 'banner.jpg',
          type: 'file',
          size: '1.2 MB',
          lastModified: '2025-04-15',
        },
        {
          name: 'logo.png',
          type: 'file',
          size: '340 KB',
          lastModified: '2025-05-12',
        },
      ];
    } else if (path === '/documents/') {
      return [
        {
          name: 'project_specs.pdf',
          type: 'file',
          size: '2.8 MB',
          lastModified: '2025-05-05',
        },
        {
          name: 'meeting_notes.docx',
          type: 'file',
          size: '156 KB',
          lastModified: '2025-05-18',
        },
      ];
    } else if (path === '/images/profile/') {
      return [
        {
          name: 'avatar.png',
          type: 'file',
          size: '120 KB',
          lastModified: '2025-03-22',
        },
        {
          name: 'team.jpg',
          type: 'file',
          size: '2.4 MB',
          lastModified: '2025-04-30',
        },
      ];
    }
    return [];
  };

  // Navigate up one directory
  const navigateUp = () => {
    if (currentPath === '/') return;

    const pathParts = currentPath.split('/').filter(Boolean);
    pathParts.pop();
    const newPath = pathParts.length === 0 ? '/' : `/${pathParts.join('/')}/`;
    loadItems(newPath);
  };

  // // Toggle folder expansion (for nested view)
  // const toggleFolder = (path) => {
  //   setExpandedFolders((prev) => ({
  //     ...prev,
  //     [path]: !prev[path],
  //   }));

  //   // If expanding, load items for this folder
  //   if (!expandedFolders[path]) {
  //     loadItems(path);
  //   }
  // };

  // Simulate downloading a file
  const downloadFile = (fileName) => {
    alert(`Downloading ${fileName}...`);
    // In a real implementation, this would use the AWS SDK to generate a signed URL and trigger download
  };

  const onSubmit = useCallback(
    async (values) => {
      console.log('Form submitted:', values);
      // onRename(values.queryName);
      // onClose();
      try {
        const s3Client = new S3Client({
          region: values.region,
          credentials: {
            accessKeyId: values.accessKeyId,
            secretAccessKey: values.secretAccessKey,
            sessionToken: values.sessionToken, // <-- required if you're using temporary credentials
          },
        });

        const files = await listFilesAndDirectoriesWithPrefix(
          s3Client,
          values.bucket,
          '',
        );
        console.log('listFiles,', files);
      } catch (error) {
        console.error('Error listing files:', error);
        setError(error.message);
      }
    },
    [setError],
  );

  return (
    <div className="flex flex-col items-center">
      {/* Connection Panel */}
      {!isConnected ? (
        <div className="flex w-[300px] max-w-md flex-col gap-4 p-4">
          <h2 className="text-xl font-semibold">Connect to Amazon S3</h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="bucket"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Bucket Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="text"
                        placeholder="my-bucket-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="region"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Region</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a Region" />
                        </SelectTrigger>
                        <SelectContent>
                          {S3_REGIONS.map((region) => (
                            <SelectItem key={region.value} value={region.value}>
                              {region.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="accessKeyId"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Access Key</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="text"
                        className="w-full rounded-md border px-3 py-2"
                        placeholder="AKIAXXXXXXXXXXXXXXXX"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="secretAccessKey"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Secret Access Key</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="••••••••••••••••••••••••"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="w-full transition duration-200 disabled:opacity-50"
              >
                {isLoading ? 'Connecting...' : 'Connect to S3'}
              </Button>
            </form>
          </Form>
        </div>
      ) : (
        <>
          {/* Header with bucket info and navigation */}
          {/* <div className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold">S3 Browser: {bucketName}</h1>
                <div className="text-sm text-gray-500">Region: {region}</div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => loadItems(currentPath)}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                  title="Refresh"
                >
                  <RefreshCw size={18} />
                </button>
                <button
                  onClick={() => setIsConnected(false)}
                  className="bg-gray-200 text-gray-800 px-3 py-1 rounded-md hover:bg-gray-300 text-sm"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div> */}

          {/* Current path navigation */}
          {/* <div className="bg-gray-100 p-2 flex items-center space-x-2 border-b border-gray-200">
            <button
              onClick={navigateUp}
              disabled={currentPath === '/'}
              className={`p-1 rounded-md ${currentPath === '/' ? 'text-gray-400' : 'text-gray-600 hover:bg-gray-200'}`}
              title="Go up one level"
            >
              <ArrowUp size={16} />
            </button>
            <div className="text-sm flex-1 overflow-x-auto whitespace-nowrap py-1">
              <span className="font-medium">Path:</span> {currentPath}
            </div>
          </div> */}

          {/* File/Folder listing */}
          {/* <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <div className="text-gray-500">Loading...</div>
              </div>
            ) : items.length === 0 ? (
              <div className="flex justify-center items-center h-full">
                <div className="text-gray-500">No items found in this location</div>
              </div>
            ) : (
              <table className="min-w-full bg-white">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Size</th>
                    <th className="px-6 py-3">Last Modified</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {item.type === 'folder' ? (
                            <>
                              <button
                                onClick={() => toggleFolder(item.path)}
                                className="mr-2 text-gray-500"
                              >
                                {expandedFolders[item.path] ? (
                                  <ChevronDown size={18} />
                                ) : (
                                  <ChevronRight size={18} />
                                )}
                              </button>
                              <Folder size={18} className="text-blue-500 mr-2" />
                              <button
                                onClick={() => loadItems(item.path)}
                                className="hover:underline text-blue-600"
                              >
                                {item.name}
                              </button>
                            </>
                          ) : (
                            <>
                              <File size={18} className="text-gray-500 ml-6 mr-2" />
                              <span>{item.name}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {item.type === 'folder' ? 'Folder' : 'File'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {item.type === 'folder' ? '--' : item.size}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {item.type === 'folder' ? '--' : item.lastModified}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {item.type === 'file' && (
                          <button
                            onClick={() => downloadFile(item.name)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Download file"
                          >
                            <Download size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div> */}
        </>
      )}

      {/* Status footer */}
      {/* <div className="border-t border-gray-200 bg-gray-100 px-4 py-2 text-xs text-gray-500">
        {isConnected
          ? `Connected to ${bucketName} • Region: ${region} • ${items.length} items`
          : 'Not connected to any S3 bucket'}
      </div> */}
    </div>
  );
};
