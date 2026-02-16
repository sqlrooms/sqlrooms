# Contributing to _SQLRooms_

We want to make contributing to this project as easy and transparent as possible.

## Code of Conduct

SQLRooms has a Code of Conduct that we expect project participants to adhere
to. Please read [the full text](https://github.com/sqlrooms/sqlrooms/blob/HEAD/CODE_OF_CONDUCT.md) so that you can understand
what actions will and will not be tolerated.

## Our Development Process

We use example applications to test and validate changes. You can run the examples by following these steps:

```bash
# Install dependencies
pnpm install
# Build the packages
pnpm build
# Go to an example directory
cd examples/ai  # or any other example
# Run the example
pnpm dev
```

If you've added a new feature, changed the configuration or public methods, please:

1. Add a new example or modify existing ones to demonstrate the functionality
2. Make sure examples which might be affected by the changes continue to work after your changes
3. Suggest appropriate changes to the documentation

## Pull Requests

We actively welcome pull requests. If you want to submit one, please follow the following process:

1. Fork the repo and create your branch from `main`
2. Make changes
3. Make sure the project builds after your changes
4. Make changes to the documentation if applicable
5. Submit a PR on GitHub

## License

By contributing to _SQLRooms_, you agree that your contributions will be licensed its MIT license.
