---
outline: deep
---

# What is SQLRooms?

SQLRooms provides a foundation and set of building blocks for creating data analytics applications that run entirely in the browser. It combines essential components like a SQL query engine (DuckDB), data visualization tools, state management, and UI components into a cohesive toolkit, making it significantly easier to create powerful analytics tools without a backend.

<a href="/examples">
  <img src="/media/overview/collage.webp" alt="SQLRooms example apps" width=600>
</a>

## Who is it for?

SQLRooms is designed for developers building:

- Interactive data analysis tools
- Custom BI solutions
- Data visualization applications
- Internal analytics dashboards

## Motivation

Modern data analytics applications face several challenges that SQLRooms addresses:

### Developer Experience

Building analytics applications typically requires integrating multiple complex components. SQLRooms provides a complete foundation with state management, UI components, and [extensible architecture](/architecture) out of the box.

### Performance and Scale

DuckDB is purpose-built for analytics, providing fast query performance on large datasets through its columnar engine and optimized query processing. Running in the browser through WebAssembly, each user gets their own instance, enabling automatic scaling without infrastructure costs. Applications can even work offline, as there's no dependency on backend services.

### AI-Powered Analytics

The browser-based DuckDB engine enables powerful AI-driven analytics workflows:

- Interactive AI agents that can write and execute SQL queries
- Automated data analysis and insights generation

Check out our [AI example](/examples#ai-powered-analytics) that demonstrates how to build an AI agent that can analyze your data using natural language, execute SQL queries, and provide insights – all running directly in the browser.

### Privacy and Security

SQLRooms enables applications where sensitive data can remain completely client-side, as all data processing and analysis can be performed directly in the browser using DuckDB. This architecture allows for implementations where data never needs to leave the client, simplifying compliance and security requirements when needed.

## Conclusion

SQLRooms provides a powerful foundation for building browser-based data analytics applications with no backend requirements. By combining DuckDB's SQL engine with modern web technologies, it enables developers to create performant, scalable, and privacy-focused data tools.

Ready to dive deeper? Check out our [Architecture Guide](/architecture) to understand how SQLRooms components work together and how you can leverage them in your applications.
