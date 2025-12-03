import {zodResolver} from '@hookform/resolvers/zod';
import {makeQualifiedTableName} from '@sqlrooms/duckdb';
import {SqlQueryDataSource} from '@sqlrooms/room-shell';
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Spinner,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from '@sqlrooms/ui';
import {Check, ChevronsUpDown, HelpCircle} from 'lucide-react';
import {FC, useCallback, useMemo, useState} from 'react';
import {useForm} from 'react-hook-form';
import * as z from 'zod';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';
import {SqlMonacoEditor} from '../SqlMonacoEditor';

const VALID_TABLE_OR_COLUMN_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;

const formSchema = z.object({
  tableName: z
    .string()
    .min(1, 'Table name is required')
    .regex(
      VALID_TABLE_OR_COLUMN_REGEX,
      'Only letters, digits and underscores are allowed; should not start with a digit',
    ),
  query: z.string().min(1, 'Query is required'),
  schema: z.string().optional(),
  database: z.string().optional(),
  replace: z.boolean(),
  temp: z.boolean(),
  view: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

/**
 * Initial values for the create table form.
 */
export type CreateTableFormInitialValues = Partial<{
  tableName: string;
  replace: boolean;
  temp: boolean;
  view: boolean;
  schema: string;
  database: string;
}>;

export type CreateTableModalProps = {
  query: string;
  isOpen: boolean;
  onClose: () => void;
  editDataSource?: SqlQueryDataSource;
  /**
   * Allow multiple statements in the query. When true, preceding statements
   * will be executed before the final SELECT is wrapped in CREATE TABLE/VIEW.
   */
  allowMultipleStatements?: boolean;
  /**
   * Show schema/database selection UI.
   * @default false
   */
  showSchemaSelection?: boolean;
  /**
   * @deprecated Use createTableFromQuery directly instead.
   * When not provided, the modal will call createTableFromQuery directly.
   */
  onAddOrUpdateSqlQuery?: (
    tableName: string,
    query: string,
    oldTableName?: string,
  ) => Promise<void>;
  /**
   * Additional class name for the dialog content.
   */
  className?: string;
  /**
   * Initial values for the form fields.
   */
  initialValues?: CreateTableFormInitialValues;
};

type CreateTableFormProps = {
  query: string;
  onClose: () => void;
  editDataSource?: SqlQueryDataSource;
  allowMultipleStatements?: boolean;
  showSchemaSelection?: boolean;
  onAddOrUpdateSqlQuery?: (
    tableName: string,
    query: string,
    oldTableName?: string,
  ) => Promise<void>;
  initialValues?: CreateTableFormInitialValues;
};

/**
 * Compact searchable combobox for selecting schema or database.
 */
const SchemaCombobox: FC<{
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  options: string[];
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  disabled?: boolean;
}> = ({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  disabled,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full min-w-0 justify-between font-mono text-xs"
          disabled={disabled}
        >
          <span className="min-w-0 truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[180px] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="text-xs" />
          <CommandList>
            <CommandEmpty className="text-xs">{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  className="text-xs"
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? undefined : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-3 w-3',
                      value === option ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

/**
 * Compact checkbox option with clickable label and tooltip.
 */
const OptionCheckbox: FC<{
  id: string;
  label: string;
  tooltip: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}> = ({id, label, tooltip, checked, onCheckedChange, disabled}) => (
  <div className="flex items-center gap-1.5">
    <Checkbox
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="h-3.5 w-3.5"
    />
    <Label
      htmlFor={id}
      className={cn(
        'cursor-pointer text-xs font-normal',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {label}
    </Label>
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="text-muted-foreground h-3 w-3 cursor-help" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[200px] text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  </div>
);

const CreateTableForm: FC<CreateTableFormProps> = ({
  query,
  onClose,
  editDataSource,
  allowMultipleStatements = false,
  showSchemaSelection = false,
  onAddOrUpdateSqlQuery,
  initialValues,
}) => {
  const connector = useStoreWithSqlEditor((state) => state.db.connector);
  const createTableFromQuery = useStoreWithSqlEditor(
    (state) => state.db.createTableFromQuery,
  );
  const refreshTableSchemas = useStoreWithSqlEditor(
    (state) => state.db.refreshTableSchemas,
  );
  const tables = useStoreWithSqlEditor((state) => state.db.tables);
  const currentSchema = useStoreWithSqlEditor(
    (state) => state.db.currentSchema,
  );
  const currentDatabase = useStoreWithSqlEditor(
    (state) => state.db.currentDatabase,
  );

  // Extract unique schemas and databases from tables (excluding system ones)
  const {schemas, databases} = useMemo(() => {
    const schemaSet = new Set<string>();
    const databaseSet = new Set<string>();

    for (const table of tables) {
      if (table.table.schema && !table.table.schema.startsWith('pg_')) {
        schemaSet.add(table.table.schema);
      }
      if (table.table.database) {
        databaseSet.add(table.table.database);
      }
    }

    // Ensure current schema/database are included
    if (currentSchema) schemaSet.add(currentSchema);
    if (currentDatabase) databaseSet.add(currentDatabase);

    return {
      schemas: Array.from(schemaSet).sort(),
      databases: Array.from(databaseSet).sort(),
    };
  }, [tables, currentSchema, currentDatabase]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema as any),
    defaultValues: {
      tableName: editDataSource?.tableName ?? initialValues?.tableName ?? '',
      query: editDataSource?.sqlQuery ?? query.trim(),
      schema: initialValues?.schema ?? currentSchema,
      database: initialValues?.database ?? currentDatabase,
      replace: initialValues?.replace ?? false,
      temp: initialValues?.temp ?? false,
      view: initialValues?.view ?? false,
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = useCallback(
    async (values: FormValues) => {
      try {
        const {tableName, query, schema, database, replace, temp, view} =
          values;

        if (onAddOrUpdateSqlQuery) {
          // Legacy path: use the callback
          await onAddOrUpdateSqlQuery(
            tableName,
            query,
            editDataSource?.tableName,
          );
        } else {
          // New path: call createTableFromQuery directly
          const qualifiedName =
            schema || database
              ? makeQualifiedTableName({table: tableName, schema, database})
              : tableName;

          await createTableFromQuery(qualifiedName, query, {
            replace,
            temp,
            view,
            allowMultipleStatements,
          });

          // Refresh table schemas to show the new table
          await refreshTableSchemas();
        }

        form.reset();
        onClose();
      } catch (err) {
        form.setError('root', {type: 'manual', message: `${err}`});
      }
    },
    [
      onAddOrUpdateSqlQuery,
      editDataSource?.tableName,
      createTableFromQuery,
      allowMultipleStatements,
      refreshTableSchemas,
      onClose,
      form,
    ],
  );

  const watchView = form.watch('view');
  const watchTemp = form.watch('temp');
  const watchTableName = form.watch('tableName');

  return (
    <TooltipProvider delayDuration={200}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {editDataSource
                ? 'Edit table query'
                : watchView
                  ? 'Create view from query'
                  : 'Create table from query'}
            </DialogTitle>
            {!editDataSource && (
              <DialogDescription>
                {watchView
                  ? 'Create a new view from an SQL query.'
                  : 'Create a new table from the results of an SQL query.'}
              </DialogDescription>
            )}
          </DialogHeader>

          {form.formState.errors.root && (
            <Alert variant="destructive">
              <AlertDescription className="whitespace-pre-wrap font-mono text-xs">
                {form.formState.errors.root.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Table name, schema, database in single row */}
          <div className="flex items-end gap-3">
            <FormField
              control={form.control}
              name="tableName"
              render={({field}) => (
                <FormItem className="min-w-0 flex-[2]">
                  <FormLabel className="text-xs">
                    {watchView ? 'View name' : 'Table name'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="h-9 font-mono text-xs"
                      autoFocus
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            {showSchemaSelection && (
              <>
                <FormField
                  control={form.control}
                  name="schema"
                  render={({field}) => (
                    <FormItem className="min-w-0 flex-1">
                      <FormLabel className="text-xs">Schema</FormLabel>
                      <FormControl>
                        <SchemaCombobox
                          value={field.value}
                          onChange={field.onChange}
                          options={schemas}
                          placeholder="Schema..."
                          searchPlaceholder="Search..."
                          emptyMessage="No schemas."
                          disabled={isSubmitting}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {(databases.length > 1 || watchTemp) && (
                  <FormField
                    control={form.control}
                    name="database"
                    render={({field}) => (
                      <FormItem className="min-w-0 flex-1">
                        <FormLabel className="text-xs">Database</FormLabel>
                        <FormControl>
                          <SchemaCombobox
                            value={watchTemp ? 'temp' : field.value}
                            onChange={field.onChange}
                            options={databases}
                            placeholder="Database..."
                            searchPlaceholder="Search..."
                            emptyMessage="No databases."
                            disabled={isSubmitting || watchTemp}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}
          </div>

          <FormField
            control={form.control}
            name="query"
            render={({field}) => (
              <FormItem className="relative flex h-[200px] flex-col">
                <FormControl>
                  <SqlMonacoEditor
                    connector={connector}
                    value={field.value}
                    onChange={field.onChange}
                    className="absolute inset-0 h-full w-full"
                    options={{
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      minimap: {enabled: false},
                      wordWrap: 'on',
                      folding: false,
                      lineNumbers: 'off',
                      readOnly: isSubmitting,
                      fixedOverflowWidgets: false, // default true doesn't work well in a modal
                    }}
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          {/* Compact options row */}
          {!onAddOrUpdateSqlQuery && (
            <div className="flex items-center gap-6 rounded-md border px-3 py-2">
              <FormField
                control={form.control}
                name="view"
                render={({field}) => (
                  <OptionCheckbox
                    id="create-table-view"
                    label="View"
                    tooltip="Create a view instead of a table. Views store the query, not the data."
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                  />
                )}
              />

              {/* <FormField
                control={form.control}
                name="temp"
                render={({field}) => (
                  <OptionCheckbox
                    id="create-table-temp"
                    label="Temporary"
                    tooltip={`${watchView ? 'View' : 'Table'} will be deleted when the session ends.`}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                  />
                )}
              /> */}

              <FormField
                control={form.control}
                name="replace"
                render={({field}) => (
                  <OptionCheckbox
                    id="create-table-replace"
                    label="Overwrite"
                    tooltip={`Overwrite existing ${watchView ? 'view' : 'table'} with the same name if it exists.`}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                  />
                )}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !watchTableName?.trim()}
            >
              {isSubmitting && <Spinner className="mr-2" />}
              {editDataSource ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </TooltipProvider>
  );
};

const CreateTableModal: FC<CreateTableModalProps> = (props) => {
  const {
    isOpen,
    onClose,
    query,
    editDataSource,
    allowMultipleStatements,
    showSchemaSelection,
    onAddOrUpdateSqlQuery,
    className,
    initialValues,
  } = props;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn('w-3xl max-w-[80%]', className)}>
        {isOpen && (
          <CreateTableForm
            query={query}
            onClose={onClose}
            editDataSource={editDataSource}
            allowMultipleStatements={allowMultipleStatements}
            showSchemaSelection={showSchemaSelection}
            onAddOrUpdateSqlQuery={onAddOrUpdateSqlQuery}
            initialValues={initialValues}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateTableModal;
