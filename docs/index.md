---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: 'SQLRooms'
  text: 'Build data-centric apps with DuckDB'
  tagline: An Open Source Framework for Building Local-First Data Analytics Apps powered by DuckDB
  actions:
    - theme: brand
      text: What is SQLRooms?
      link: /overview
    - theme: alt
      text: Example Apps
      link: /examples
    - theme: alt
      text: View on GitHub
      link: https://github.com/sqlrooms/sqlrooms
  image:
    # Must be in the public/ directory (see https://github.com/vuejs/vitepress/issues/4097#issuecomment-2261203743)
    src: /media/sqlrooms-ai.webp
    alt: SQLRooms AI

features:
  - title: Blazing-Fast Local Analytics
    details: Leverage DuckDB's powerful SQL capabilities, enabling fast in browser data processing without a backend
  - title: Own Your Data
    details: Data remains on your local device for maximum privacy, sub-second analytics on large datasets, and offline functionality
  - title: AI Integration
    details: Use agents that can write and execute SQL queries, and generate insights without sharing your data with model providers
  - title: Modular Architecture
    details: Pick and choose the functionality you need for composable, extensible applications, with integrations for popular data visualization libraries.
  - title: Modern UI Components
    details: Comprehensive set of React components including data tables, layouts, and visualization tools for building beautiful analytics interfaces
  - title: Flexible Layouts
    details: Customizable mosaic-style layouts for creating responsive and user-friendly analytics dashboards
---
