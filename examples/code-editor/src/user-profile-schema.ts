// Example JSON schema for a user profile
export const userProfileSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Full name of the user',
      minLength: 2,
      maxLength: 50,
    },
    email: {
      type: 'string',
      description: 'Email address',
      format: 'email',
    },
    age: {
      type: 'number',
      description: 'Age in years',
      minimum: 18,
      maximum: 120,
    },
    status: {
      type: 'string',
      description: 'Account status',
      enum: ['active', 'inactive', 'pending', 'suspended'],
    },
    premium: {
      type: 'boolean',
      description: 'Premium membership status',
    },
    role: {
      type: 'string',
      description: 'User role',
      enum: ['admin', 'user', 'moderator', 'guest'],
    },
    tags: {
      type: 'array',
      description: 'User tags',
      items: {
        type: 'string',
        enum: ['developer', 'designer', 'manager', 'analyst'],
      },
    },
    settings: {
      type: 'object',
      description: 'User preferences',
      properties: {
        theme: {
          type: 'string',
          description: 'UI theme',
          enum: ['light', 'dark', 'auto'],
        },
        notifications: {
          type: 'boolean',
          description: 'Enable notifications',
        },
        language: {
          type: 'string',
          description: 'Preferred language',
          enum: ['en', 'es', 'fr', 'de', 'ja'],
        },
      },
      required: ['theme'],
    },
    addresses: {
      type: 'array',
      description: 'User addresses',
      items: {
        type: 'object',
        properties: {
          street: {
            type: 'string',
            description: 'Street address',
          },
          city: {
            type: 'string',
            description: 'City name',
          },
          country: {
            type: 'string',
            description: 'Country code',
            enum: ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP'],
          },
          primary: {
            type: 'boolean',
            description: 'Is primary address',
          },
        },
        required: ['street', 'city', 'country'],
      },
    },
    socialMedia: {
      type: 'object',
      description: 'Social media profiles',
      properties: {
        twitter: {
          type: 'string',
          description: 'Twitter handle',
        },
        linkedin: {
          type: 'string',
          description: 'LinkedIn profile URL',
        },
        github: {
          type: 'string',
          description: 'GitHub username',
        },
      },
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata',
      properties: {
        lastLogin: {
          type: 'string',
          format: 'date-time',
          description: 'Last login timestamp',
        },
        loginCount: {
          type: 'number',
          description: 'Total login count',
          minimum: 0,
        },
      },
    },
    bio: {
      type: ['string', 'null'],
      description: 'User biography (optional)',
      maxLength: 500,
    },
    phoneNumber: {
      type: ['string', 'null'],
      description: 'Phone number (optional)',
    },
    newsletter: {
      type: ['boolean', 'null'],
      description: 'Newsletter subscription (null = not decided)',
    },
    referralCode: {
      type: ['string', 'null'],
      description: 'Referral code if referred by another user',
      enum: ['FRIEND2024', 'PROMO50', 'WELCOME', null],
    },
    accountType: {
      type: ['string', 'null'],
      description: 'Account type (null = default free account)',
      enum: ['free', 'premium', 'enterprise', null],
    },
  },
  required: ['name', 'email', 'status'],
};

// Example initial JSON data
export const initialUserData = {
  name: 'John Doe',
  email: 'john@example.com',
  age: 28,
  status: 'active',
  premium: true,
  role: 'admin',
  tags: ['developer', 'manager'],
  settings: {
    theme: 'dark',
    notifications: true,
    language: 'en',
  },
  addresses: [
    {
      street: '123 Main St',
      city: 'San Francisco',
      country: 'US',
      primary: true,
    },
    {
      street: '456 Oak Ave',
      city: 'New York',
      country: 'US',
      primary: false,
    },
  ],
  socialMedia: {
    twitter: '@johndoe',
    github: 'johndoe',
  },
  metadata: {
    lastLogin: '2024-03-09T10:30:00Z',
    loginCount: 42,
  },
  bio: 'Software engineer passionate about building great products',
  phoneNumber: '+1-555-0123',
  newsletter: true,
  referralCode: null,
  accountType: 'premium',
};
