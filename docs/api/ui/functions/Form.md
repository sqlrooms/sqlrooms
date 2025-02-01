[@sqlrooms/ui](../index.md) / Form

# Function: Form()

> **Form**\<`TFieldValues`, `TContext`, `TTransformedValues`\>(`props`): `Element`

A provider component that propagates the `useForm` methods to all children components via [React Context](https://reactjs.org/docs/context.html) API. To be used with useFormContext.

## Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `TFieldValues` *extends* `FieldValues` | - |
| `TContext` | `any` |
| `TTransformedValues` *extends* `undefined` \| `FieldValues` | `undefined` |

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `props` | `FormProviderProps`\<`TFieldValues`, `TContext`, `TTransformedValues`\> | all useForm methods |

## Returns

`Element`

## Remarks

[API](https://react-hook-form.com/docs/useformcontext) • [Demo](https://codesandbox.io/s/react-hook-form-v7-form-context-ytudi)

## Example

```tsx
function App() {
  const methods = useForm();
  const onSubmit = data => console.log(data);

  return (
    <FormProvider {...methods} >
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <NestedInput />
        <input type="submit" />
      </form>
    </FormProvider>
  );
}

 function NestedInput() {
  const { register } = useFormContext(); // retrieve all hook methods
  return <input {...register("test")} />;
}
```
