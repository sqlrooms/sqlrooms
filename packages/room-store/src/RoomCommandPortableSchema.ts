export type RoomCommandPortableSchema = {
  type?: string;
  $schema?: string;
  title?: string;
  description?: string;
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  format?: string;
  properties?: Record<string, RoomCommandPortableSchema>;
  required?: string[];
  items?: RoomCommandPortableSchema;
  anyOf?: RoomCommandPortableSchema[];
  additionalProperties?: boolean | RoomCommandPortableSchema;
  [key: string]: unknown;
};
