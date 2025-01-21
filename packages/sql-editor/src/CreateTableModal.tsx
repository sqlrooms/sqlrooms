import {
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
  Textarea,
  Alert,
  AlertDescription,
} from '@sqlrooms/ui';
import {DuckQueryError} from '@sqlrooms/duckdb';
import {
  SqlQueryDataSource,
  VALID_TABLE_OR_COLUMN_REGEX,
} from '@sqlrooms/project-config';
import {FC, useCallback} from 'react';
import {useForm} from 'react-hook-form';
import * as z from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';

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

export type Props = {
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

const CreateTableModal: FC<Props> = (props) => {
  const {editDataSource, isOpen, onClose, onAddOrUpdateSqlQuery} = props;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
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
        form.setError('root', {
          type: 'manual',
          message:
            err instanceof DuckQueryError ? err.getMessageForUser() : `${err}`,
        });
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
                <AlertDescription>
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
                <FormItem>
                  <FormLabel>SQL query:</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      className="font-mono text-sm bg-secondary min-h-[200px]"
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
