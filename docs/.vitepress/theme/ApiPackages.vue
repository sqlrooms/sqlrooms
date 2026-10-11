<script setup lang="ts">
import {withBase} from 'vitepress';
import apiPackageCategories from '../api-packages.json';

const sortedApiPackageCategories = apiPackageCategories.map((category) => ({
  ...category,
  packages: [...category.packages].sort((a, b) => a.name.localeCompare(b.name)),
}));

function headingId(heading: string) {
  return heading.toLowerCase().replaceAll(' ', '-');
}
</script>

<template>
  <section
    v-for="category in sortedApiPackageCategories"
    :key="category.text"
    class="api-package-category"
  >
    <h2 :id="headingId(category.text)" tabindex="-1">
      {{ category.text }}
      <a
        class="header-anchor"
        :href="`#${headingId(category.text)}`"
        :aria-label="`Permalink to ${category.text}`"
      />
    </h2>
    <table class="api-package-table">
      <colgroup>
        <col class="api-package-name-column" />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Package</th>
          <th scope="col">Description</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="packageMetadata in category.packages"
          :key="packageMetadata.name"
        >
          <td>
            <a :href="withBase(`/api/${packageMetadata.name}/`)">
              <strong>@sqlrooms/{{ packageMetadata.name }}</strong>
            </a>
          </td>
          <td>{{ packageMetadata.description }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.api-package-category + .api-package-category {
  margin-top: 2.5rem;
}

.api-package-table {
  display: table;
  table-layout: fixed;
  width: 100%;
}

.api-package-name-column {
  width: 15rem;
}

.api-package-table td {
  line-height: 1.5;
  vertical-align: top;
}

.api-package-table tr:nth-child(2n) {
  background-color: var(--vp-c-bg);
}

@media (max-width: 640px) {
  .api-package-table {
    display: block;
    table-layout: auto;
  }

  .api-package-name-column {
    width: auto;
  }
}
</style>
