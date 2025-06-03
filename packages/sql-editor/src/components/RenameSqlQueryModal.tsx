import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  DialogDescription,
} from '@sqlrooms/ui';
import React, {useEffect} from 'react';
import {useForm} from 'react-hook-form';
import * as z from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';

const formSchema = z.object({
  queryName: z.string().min(1, 'Query name is required'),
});

type FormData = z.infer<typeof formSchema>;

const RenameSqlQueryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  initialName: string;
  onRename: (newName: string) => void;
}> = ({isOpen, onClose, initialName, onRename}) => {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      queryName: initialName,
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({queryName: initialName});
    }
  }, [isOpen, initialName, form]);

  function onSubmit(values: FormData) {
    onRename(values.queryName);
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename</DialogTitle>
          <DialogDescription>Rename the query to a new name.</DialogDescription>
        </DialogHeader>
        {/* @ts-expect-error react-hook-form type are incompatible between react versions */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              // @ts-expect-error react-hook-form type are incompatible between react versions
              control={form.control}
              name="queryName"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Query Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoFocus
                      placeholder="Enter query name"
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
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default RenameSqlQueryModal;
