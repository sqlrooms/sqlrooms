import {zodResolver} from '@hookform/resolvers/zod';
import {SqlQueryDataSource} from '@sqlrooms/project-builder';
import {
  Alert,
  AlertDescription,
  Button,
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
} from '@sqlrooms/ui';
import {FC, useCallback} from 'react';
import {useForm} from 'react-hook-form';
import * as z from 'zod';
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
});

export type CreateTableModalProps = {
  query: string;
  isOpen: boolean;
  onClose: () => void;
  editDataSource?: SqlQueryDataSource;
  onAddOrUpdateSqlQuery: (
    tableName: string,
    query: string,
    oldTableName?: string,
  ) => Promise<void>;
};

const CreateTableModal: FC<CreateTableModalProps> = (props) => {
  const {editDataSource, isOpen, onClose, onAddOrUpdateSqlQuery} = props;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    values: {
      tableName: editDataSource?.tableName ?? '',
      query: editDataSource?.sqlQuery ?? props.query.trim(),
    },
  });

  const onSubmit = useCallback(
    async (values: z.infer<typeof formSchema>) => {
      try {
        const {tableName, query} = values;
        await onAddOrUpdateSqlQuery(
          tableName,
          query,
          editDataSource?.tableName,
        );
        form.reset();
        onClose();
      } catch (err) {
        form.setError('root', {type: 'manual', message: `${err}`});
      }
    },
    [onAddOrUpdateSqlQuery, editDataSource?.tableName, onClose, form],
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {editDataSource
                  ? 'Edit table query'
                  : 'Create table from query'}
              </DialogTitle>
              {!editDataSource && (
                <DialogDescription>
                  Create a new table from the results of an SQL query.
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

            <FormField
              control={form.control}
              name="tableName"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Table name:</FormLabel>
                  <FormControl>
                    <Input {...field} className="font-mono" autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="query"
              render={({field}) => (
                <FormItem className="flex flex-col">
                  <FormLabel>SQL query:</FormLabel>
                  <FormControl>
                    <SqlMonacoEditor
                      value={field.value}
                      onChange={field.onChange}
                      className="h-[200px] w-full"
                      options={{
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        minimap: {enabled: false},
                        wordWrap: 'on',
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {editDataSource ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTableModal;
