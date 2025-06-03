import React, {useState, useCallback, useEffect} from 'react';
import {useForm, SubmitHandler} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import * as z from 'zod';
import {Tabs, TabsList, TabsTrigger, TabsContent} from '@sqlrooms/ui';
import {S3Config, S3Connection} from '@sqlrooms/s3';

import {
  Input,
  Textarea,
  Button,
  Checkbox,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@sqlrooms/ui';

import {
  Eye,
  EyeOff,
  Upload,
  Check,
  AlertCircle,
  Info,
  PlusIcon,
  Database,
  Trash2,
} from 'lucide-react';

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

const formSchema = z.object({
  accessKeyId: z.string().min(1, 'Required'),
  secretAccessKey: z.string().min(1, 'Required'),
  sessionToken: z.string().optional(),
  region: z.string().min(1, 'Required'),
  bucket: z.string().min(1, 'Required'),
  name: z.string().max(100, 'Max 100 characters').optional(),
  saveConnection: z.boolean().default(false).optional(),
});

type FormData = z.infer<typeof formSchema>;

type ParsedType = {
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  region?: string;
};
const parseAWSExport = (text: string): ParsedType => {
  const lines = text.split('\n');
  const parsed = {} as Record<string, string>;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('export AWS_ACCESS_KEY_ID=')) {
      parsed.accessKeyId = trimmed.split('=')[1]?.replace(/['"]/g, '') || '';
    } else if (trimmed.startsWith('export AWS_SECRET_ACCESS_KEY=')) {
      parsed.secretAccessKey =
        trimmed.split('=')[1]?.replace(/['"]/g, '') || '';
    } else if (trimmed.startsWith('export AWS_SESSION_TOKEN=')) {
      parsed.sessionToken = trimmed.split('=')[1]?.replace(/['"]/g, '') || '';
    } else if (trimmed.startsWith('export AWS_DEFAULT_REGION=')) {
      parsed.region = trimmed.split('=')[1]?.replace(/['"]/g, '') || '';
    }
  }

  return parsed;
};

const parseCredentialProcess = (text: string): ParsedType => {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[0];
      const raw = JSON.parse(jsonStr);
      const parsed = {} as Record<string, string>;

      if (raw.AccessKeyId) {
        parsed.accessKeyId = raw.AccessKeyId;
      }
      if (raw.SecretAccessKey) {
        parsed.secretAccessKey = raw.SecretAccessKey;
      }
      if (raw.SessionToken) {
        parsed.sessionToken = raw.SessionToken;
      }
      if (raw.region) {
        // Check if region is present
        parsed.region = raw.region;
      }
      return parsed;
    }
  } catch (e) {
    console.error('Failed to parse JSON:', e);
  }
  return {};
};

/**
 * A form component for managing S3 credentials and connections.
 * 
 * This component provides:
 * - Input fields for S3 credentials (access key, secret key, region, bucket)
 * - Option to save connections for later use
 * - Ability to paste AWS credentials export format
 * - Management of saved connections
 * 
 * @example
 * ```tsx
 * const handleConnect = async (credentials) => {
 *   // Handle the connection
 *   console.log('Connecting with:', credentials);
 * };
 * 
 * const handleSaveConnection = async (config) => {
 *   // Save the connection to your storage
 *   await saveToStorage(config);
 * };
 * 
 * const handleLoadConnections = async () => {
 *   // Load saved connections from your storage
 *   return await loadFromStorage();
 * };
 * 
 * const handleDeleteConnection = async (id) => {
 *   // Delete a saved connection
 *   await deleteFromStorage(id);
 * };
 * 
 * return (
 *   <S3CredentialForm
 *     onConnect={handleConnect}
 *     isLoading={false}
 *     saveS3Connection={handleSaveConnection}
 *     loadS3Connections={handleLoadConnections}
 *     deleteS3Connection={handleDeleteConnection}
 *   />
 * );
 * ```
 */
export type S3CredentialFormProps = {
  onConnect: (data: FormData) => void;
  isLoading?: boolean;
  saveS3Connection: (data: S3Config) => Promise<void>;
  loadS3Connections: () => Promise<S3Connection[]>;
  deleteS3Connection?: (id: string) => Promise<void>;
};

export function S3CredentialForm({
  onConnect,
  isLoading,
  saveS3Connection,
  loadS3Connections,
  deleteS3Connection,
}: S3CredentialFormProps) {
  const [showSecrets, setShowSecrets] = useState({
    secretAccessKey: false,
    sessionToken: false,
  });
  const [pasteText, setPasteText] = useState('');
  const [notification, setNotification] = useState({
    show: false,
    message: '',
    type: 'success',
  });
  const [savedConnections, setSavedConnections] = useState<S3Connection[]>([]);
  const [tab, setTab] = useState('new');

  // Load saved connections on component mount
  useEffect(() => {
    let isMounted = true;
    async function fetchConnections() {
      // You can await here
      const response = await loadS3Connections();
      if (response && response.length > 0 && isMounted) {
        // Assuming loadS3Connections returns an array of connections
        setSavedConnections(response);
      }
    }
    fetchConnections();
    return () => {
      isMounted = false;
    };
  }, []);

  const resolver = zodResolver(formSchema);
  const form = useForm<FormData>({
    resolver,
    defaultValues: {
      accessKeyId: '',
      secretAccessKey: '',
      sessionToken: '',
      region: 'us-east-1',
      bucket: '',
    },
  });
  const toggleVisibility = useCallback(
    (field: 'secretAccessKey' | 'sessionToken') => {
      setShowSecrets((prev) => ({
        ...prev,
        [field]: !prev[field],
      }));
    },
    [setShowSecrets],
  );
  const showNotification = useCallback(
    (message: string, type = 'success') => {
      setNotification({show: true, message, type});
      setTimeout(
        () => setNotification({show: false, message: '', type: 'success'}),
        3000,
      );
    },
    [setNotification],
  );

  const handleAutofill = useCallback(() => {
    if (!pasteText.trim()) {
      showNotification('Please paste in aws credential first', 'error');
      return;
    }

    let parsed = null;

    // Try parsing as  export format first
    if (pasteText.includes('export AWS_')) {
      parsed = parseAWSExport(pasteText);
    }
    // Try parsing as credential_process JSON format
    else if (pasteText.includes('AccessKeyId')) {
      parsed = parseCredentialProcess(pasteText);
    }

    if (parsed) {
      for (const key in parsed) {
        if (key in parsed) {
          form.setValue(
            key as keyof ParsedType,
            parsed[key as keyof ParsedType] || '',
          );
        }
      }

      showNotification('Credentials auto-filled successfully!');
      setPasteText('');
    } else {
      showNotification(
        'Could not parse credentials. Please check the format.',
        'error',
      );
    }
  }, [pasteText, form, showNotification]);

  const handleSubmit: SubmitHandler<FormData> = useCallback(
    async (data: FormData) => {
      onConnect(data);
      if (data.saveConnection) {
        try {
          await saveS3Connection({
            accessKeyId: data.accessKeyId,
            secretAccessKey: data.secretAccessKey,
            sessionToken: data.sessionToken || undefined,
            region: data.region,
            bucket: data.bucket,
            name: data.name || `${data.bucket}-${data.region}`,
          });
          showNotification('Connection saved successfully!');
        } catch (err) {
          showNotification(`Error saving to S3: ${err}`, 'error');
        }
      }
    },
    [onConnect, saveS3Connection, showNotification],
  );

  const deleteConnection = useCallback(
    async (id: string) => {
      if (deleteS3Connection) {
        await deleteS3Connection(id);
        const connections = await loadS3Connections();
        setSavedConnections(connections);
      }
    },
    [deleteS3Connection, setSavedConnections, loadS3Connections],
  );

  return (
    <Tabs
      value={tab}
      onValueChange={setTab}
      orientation="vertical"
      defaultValue="new"
      className="flex w-full gap-6 px-4"
    >
      <TabsList className="mb-4 flex h-auto flex-col items-stretch justify-start gap-4 border-r bg-transparent pr-6">
        <TabsTrigger
          value="new"
          className="data-[state=active]:border-primary data-[state=active]:text-primary rounded-md border px-4 py-2 data-[state=active]:shadow-none"
        >
          <PlusIcon size={16} className="mr-2" />
          New Connection
        </TabsTrigger>
        <TabsTrigger
          value="saved"
          className="data-[state=active]:border-primary data-[state=active]:text-primary rounded-md border px-4 py-2 data-[state=active]:shadow-none"
        >
          <Database size={16} className="mr-2" />
          Saved Connections
        </TabsTrigger>
      </TabsList>
      <TabsContent value="new" className="mt-0 w-full">
        {/* @ts-expect-error react-hook-form type are incompatible */}
        <Form<FormData> {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="w-full">
            <div className="grid h-full w-full grid-cols-[240px_1fr] gap-8">
              <div className="flex flex-col gap-4">
                <FormField<FormData, 'bucket'>
                  // @ts-expect-error react-hook-form type are incompatible
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
                <FormField<FormData, 'region'>
                  // @ts-expect-error react-hook-form type are incompatible
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
                              <SelectItem
                                key={region.value}
                                value={region.value}
                              >
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
                <FormField<FormData, 'name'>
                  // @ts-expect-error react-hook-form type are incompatible
                  control={form.control}
                  name="name"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>Connection Name (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="text"
                          placeholder="My S3 Connection"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField<FormData, 'saveConnection'>
                  // @ts-expect-error react-hook-form type are incompatible
                  control={form.control}
                  name="saveConnection"
                  render={({field}) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          onCheckedChange={field.onChange}
                          checked={field.value}
                          className="h-4 w-4"
                        />
                      </FormControl>
                      <FormLabel>Save this connection</FormLabel>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info
                            size={16}
                            className="text-muted-foreground hover:cursor-pointer"
                          />
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <pre className="w-[300px] text-wrap break-words text-xs">
                            Save this connection securely on your computer for
                            future use. Credentials will be encrypted and stored
                            locally
                          </pre>
                        </TooltipContent>
                      </Tooltip>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {notification.show && (
                  <div
                    className={`mb-4 flex items-center gap-2 rounded-lg p-3 text-sm ${
                      notification.type === 'error'
                        ? 'text-destructive-foreground bg-destructive'
                        : 'bg-green-50 text-green-700'
                    }`}
                  >
                    {notification.type === 'error' ? (
                      <AlertCircle size={16} />
                    ) : (
                      <Check size={16} />
                    )}
                    {notification.message}
                  </div>
                )}
              </div>

              {/* From Section */}
              <div className="flex flex-col gap-4">
                {/* Auto-fill Section */}
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">
                    Auto-fill Credentials
                  </label>
                  <Textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder='Paste AWS cli command output here...&#10;&#10;Example export:&#10;export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE&#10;export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/b...&#10;export AWS_SESSION_TOKEN=AQoEXAMPLEH4aoAH0gNCAPy...&#10;&#10;Example credential_process output:&#10;{&#10;  "AccessKeyId": "AKIAIOSFODNN7EXAMPLE",&#10;  "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCY...",&#10;  "SessionToken": "AQoEXAMPLEH4aoAH0gNCAPy..."&#10;}'
                    className="h-40"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={(e) => {
                      e.preventDefault();
                      handleAutofill();
                    }}
                  >
                    <Upload size={16} />
                    Auto-fill Credentials
                  </Button>
                  <Button variant="outline" onClick={() => setPasteText('')}>
                    Clear
                  </Button>
                </div>
                <FormField<FormData, 'accessKeyId'>
                  // @ts-expect-error react-hook-form type are incompatible
                  control={form.control}
                  name="accessKeyId"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>Access Key Id</FormLabel>
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
                <FormField<FormData, 'secretAccessKey'>
                  // @ts-expect-error react-hook-form type are incompatible
                  control={form.control}
                  name="secretAccessKey"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>Secret Access Key</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={
                              showSecrets.secretAccessKey ? 'text' : 'password'
                            }
                            placeholder="••••••••••••••••••••••••"
                            className="pr-8"
                          />
                          <div className="text-muted-foreground absolute right-3 top-0 flex h-9 gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                toggleVisibility('secretAccessKey')
                              }
                              className="ml-1"
                            >
                              {showSecrets.secretAccessKey ? (
                                <EyeOff size={16} />
                              ) : (
                                <Eye size={16} />
                              )}
                            </button>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField<FormData, 'sessionToken'>
                  // @ts-expect-error react-hook-form type are incompatible
                  control={form.control}
                  name="sessionToken"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>
                        Session Token (Optional - for temporary credentials)
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={
                              showSecrets.sessionToken ? 'text' : 'password'
                            }
                            placeholder="••••••••••••••••••••••••"
                            className="pr-8"
                          />
                          <div className="text-muted-foreground absolute right-3 top-0 flex h-9 gap-1">
                            <button
                              type="button"
                              onClick={() => toggleVisibility('sessionToken')}
                              className="ml-1"
                            >
                              {showSecrets.sessionToken ? (
                                <EyeOff size={16} />
                              ) : (
                                <Eye size={16} />
                              )}
                            </button>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={
                    form.formState.isSubmitting || !form.formState.isValid
                  }
                  className="w-full"
                >
                  {isLoading ? 'Connecting...' : 'Connect to S3'}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </TabsContent>
      <TabsContent value="saved" className="mt-0 w-full">
        <div className="space-y-4">
          {savedConnections.length === 0 ? (
            <div className="flex flex-col items-center justify-between py-12">
              <Database className="text-muted-foreground mx-auto mb-4 h-8 w-8" />
              <h3 className="mb-2 text-lg font-medium">No saved connections</h3>
              <p className="text-muted-foreground">
                Create your first connection to get started
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {savedConnections.map((connection) => (
                <div
                  key={connection.id}
                  className="rounded-lg border p-4 transition-shadow hover:cursor-pointer hover:shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="mb-1 font-semibold">{connection.name}</h3>
                      <p className="text-muted-foreground mb-2 text-sm">
                        {connection.bucket}
                      </p>
                      <div className="text-muted-foreground flex items-center space-x-4 text-xs">
                        <span>Region: {connection.region}</span>
                        <span>
                          Created:{' '}
                          {new Date(connection.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => onConnect(connection)}
                        className="text-primary rounded-md bg-blue-100 px-3 py-1 text-sm hover:bg-blue-200"
                      >
                        Connect
                      </button>
                      {deleteConnection ? (
                        <button
                          onClick={() => deleteConnection(connection.id)}
                          className="rounded-md bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
