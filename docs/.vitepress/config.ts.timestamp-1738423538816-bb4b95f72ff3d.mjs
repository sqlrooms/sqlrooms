// docs/.vitepress/config.ts
import { defineConfig } from "file:///Users/ilya/Workspace/sqlrooms/node_modules/.pnpm/vitepress@1.6.3_@algolia+client-search@5.20.0_@types+node@20.17.12_@types+react@18.3.18_axios_re6t35dypsbihqbeacfwpf5i3i/node_modules/vitepress/dist/node/index.js";

// docs/.vitepress/gen-api-sidebar.ts
import fs from "fs";
import path from "path";
import { globSync } from "file:///Users/ilya/Workspace/sqlrooms/node_modules/.pnpm/glob@11.0.1/node_modules/glob/dist/esm/index.js";
var __vite_injected_original_dirname = "/Users/ilya/Workspace/sqlrooms/docs/.vitepress";
function findTypeDocSidebars(apiDir) {
  return globSync("**/typedoc-sidebar.json", {
    cwd: apiDir,
    absolute: false
  });
}
function cleanupLinks(items) {
  return items.map((item) => {
    const cleaned = { ...item };
    if (cleaned.link) {
      cleaned.link = cleaned.link.replace("/../../docs", "");
    }
    if (cleaned.items) {
      cleaned.items = cleanupLinks(cleaned.items);
    }
    return cleaned;
  });
}
function loadSidebarContent(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const items = JSON.parse(content);
  return cleanupLinks(items);
}
function flattenAndAnnotateItems(items, packageName) {
  const result = [];
  for (const category of items) {
    if (!category.items) continue;
    for (const item of category.items) {
      let suffix = "";
      if (category.text === "Type Aliases" || category.text === "Interfaces") {
        suffix = " (type)";
      } else if (category.text === "Enumerations") {
        suffix = " (enum)";
      }
      result.push({
        text: `${item.text}${suffix}`,
        link: item.link
      });
    }
  }
  return result.sort((a, b) => {
    return a.text.localeCompare(b.text);
  });
}
function generateApiSidebar(docsDir2) {
  const apiDir = path.join(docsDir2, "api");
  const sidebarFiles = findTypeDocSidebars(apiDir);
  const packages = [];
  for (const sidebarFile of sidebarFiles) {
    console.log(`Generating sidebar for ${sidebarFile}`);
    const packageName = path.dirname(sidebarFile);
    const fullPath = path.join(apiDir, sidebarFile);
    const content = loadSidebarContent(fullPath);
    packages.push({
      text: packageName,
      collapsed: true,
      items: flattenAndAnnotateItems(content, packageName)
    });
  }
  return packages;
}
var docsDir = path.resolve(__vite_injected_original_dirname, "..");
var apiSidebar = generateApiSidebar(docsDir);
var apiSidebarConfig = apiSidebar;

// docs/.vitepress/config.ts
var CORE_PACKAGES = ["project-builder", "project-config"];
var config_default = defineConfig({
  title: "SQLRooms",
  description: "Build powerful analytics apps with DuckDB in browser",
  base: "/",
  head: [
    ["link", { rel: "icon", href: "/logo.png" }],
    [
      "meta",
      {
        name: "google-site-verification",
        content: "x-FE_DDWM1BS8Eu4JOG0el7pL1gWJgIM-fwFl2EG4OU"
      }
    ]
  ],
  themeConfig: {
    logo: "/logo.png",
    search: {
      provider: "local"
    },
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: "Home", link: "/" },
      { text: "Overview", link: "/overview" },
      { text: "Get started", link: "/getting-started" },
      { text: "Reference", link: "/packages" },
      { text: "Examples", link: "/examples" }
    ],
    sidebar: [
      {
        text: "Introduction",
        items: [
          {
            text: "Overview",
            link: "/overview"
          },
          {
            text: "Getting started",
            link: "/getting-started"
          }
        ]
      },
      {
        text: "Reference",
        items: [
          {
            text: "Core Packages",
            link: "/packages#core-packages",
            items: apiSidebarConfig.filter(
              (item) => CORE_PACKAGES.includes(item.text)
            )
          },
          {
            text: "Feature Packages",
            link: "/packages#feature-packages",
            items: apiSidebarConfig.filter(
              (item) => !CORE_PACKAGES.includes(item.text)
            )
          }
        ]
      },
      {
        text: "Examples",
        items: [
          {
            text: "Examples Overview",
            link: "/examples",
            items: [
              {
                text: "Basic Example (Vite)",
                link: "/examples/#mosaic-example-vite"
              },
              {
                text: "AI Analytics (Next.js)",
                link: "/examples#ai-powered-analytics-next-js"
              }
            ]
          }
        ]
      }
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/sqlrooms/sqlrooms" }
    ]
  }
});
export {
  config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiZG9jcy8udml0ZXByZXNzL2NvbmZpZy50cyIsICJkb2NzLy52aXRlcHJlc3MvZ2VuLWFwaS1zaWRlYmFyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL2lseWEvV29ya3NwYWNlL3NxbHJvb21zL2RvY3MvLnZpdGVwcmVzc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL2lseWEvV29ya3NwYWNlL3NxbHJvb21zL2RvY3MvLnZpdGVwcmVzcy9jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2lseWEvV29ya3NwYWNlL3NxbHJvb21zL2RvY3MvLnZpdGVwcmVzcy9jb25maWcudHNcIjtpbXBvcnQge2RlZmluZUNvbmZpZ30gZnJvbSAndml0ZXByZXNzJztcbmltcG9ydCB7YXBpU2lkZWJhckNvbmZpZ30gZnJvbSAnLi9nZW4tYXBpLXNpZGViYXInO1xuXG5jb25zdCBDT1JFX1BBQ0tBR0VTID0gWydwcm9qZWN0LWJ1aWxkZXInLCAncHJvamVjdC1jb25maWcnXTtcbi8vIGh0dHBzOi8vdml0ZXByZXNzLmRldi9yZWZlcmVuY2Uvc2l0ZS1jb25maWdcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHRpdGxlOiAnU1FMUm9vbXMnLFxuICBkZXNjcmlwdGlvbjogJ0J1aWxkIHBvd2VyZnVsIGFuYWx5dGljcyBhcHBzIHdpdGggRHVja0RCIGluIGJyb3dzZXInLFxuICBiYXNlOiAnLycsXG4gIGhlYWQ6IFtcbiAgICBbJ2xpbmsnLCB7cmVsOiAnaWNvbicsIGhyZWY6ICcvbG9nby5wbmcnfV0sXG4gICAgW1xuICAgICAgJ21ldGEnLFxuICAgICAge1xuICAgICAgICBuYW1lOiAnZ29vZ2xlLXNpdGUtdmVyaWZpY2F0aW9uJyxcbiAgICAgICAgY29udGVudDogJ3gtRkVfRERXTTFCUzhFdTRKT0cwZWw3cEwxZ1dKZ0lNLWZ3RmwyRUc0T1UnLFxuICAgICAgfSxcbiAgICBdLFxuICBdLFxuICB0aGVtZUNvbmZpZzoge1xuICAgIGxvZ286ICcvbG9nby5wbmcnLFxuICAgIHNlYXJjaDoge1xuICAgICAgcHJvdmlkZXI6ICdsb2NhbCcsXG4gICAgfSxcbiAgICAvLyBodHRwczovL3ZpdGVwcmVzcy5kZXYvcmVmZXJlbmNlL2RlZmF1bHQtdGhlbWUtY29uZmlnXG4gICAgbmF2OiBbXG4gICAgICB7dGV4dDogJ0hvbWUnLCBsaW5rOiAnLyd9LFxuICAgICAge3RleHQ6ICdPdmVydmlldycsIGxpbms6ICcvb3ZlcnZpZXcnfSxcbiAgICAgIHt0ZXh0OiAnR2V0IHN0YXJ0ZWQnLCBsaW5rOiAnL2dldHRpbmctc3RhcnRlZCd9LFxuICAgICAge3RleHQ6ICdSZWZlcmVuY2UnLCBsaW5rOiAnL3BhY2thZ2VzJ30sXG4gICAgICB7dGV4dDogJ0V4YW1wbGVzJywgbGluazogJy9leGFtcGxlcyd9LFxuICAgIF0sXG5cbiAgICBzaWRlYmFyOiBbXG4gICAgICB7XG4gICAgICAgIHRleHQ6ICdJbnRyb2R1Y3Rpb24nLFxuICAgICAgICBpdGVtczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHRleHQ6ICdPdmVydmlldycsXG4gICAgICAgICAgICBsaW5rOiAnL292ZXJ2aWV3JyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHRleHQ6ICdHZXR0aW5nIHN0YXJ0ZWQnLFxuICAgICAgICAgICAgbGluazogJy9nZXR0aW5nLXN0YXJ0ZWQnLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICB0ZXh0OiAnUmVmZXJlbmNlJyxcbiAgICAgICAgaXRlbXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0ZXh0OiAnQ29yZSBQYWNrYWdlcycsXG4gICAgICAgICAgICBsaW5rOiAnL3BhY2thZ2VzI2NvcmUtcGFja2FnZXMnLFxuICAgICAgICAgICAgaXRlbXM6IGFwaVNpZGViYXJDb25maWcuZmlsdGVyKChpdGVtKSA9PlxuICAgICAgICAgICAgICBDT1JFX1BBQ0tBR0VTLmluY2x1ZGVzKGl0ZW0udGV4dCksXG4gICAgICAgICAgICApLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgdGV4dDogJ0ZlYXR1cmUgUGFja2FnZXMnLFxuICAgICAgICAgICAgbGluazogJy9wYWNrYWdlcyNmZWF0dXJlLXBhY2thZ2VzJyxcbiAgICAgICAgICAgIGl0ZW1zOiBhcGlTaWRlYmFyQ29uZmlnLmZpbHRlcihcbiAgICAgICAgICAgICAgKGl0ZW0pID0+ICFDT1JFX1BBQ0tBR0VTLmluY2x1ZGVzKGl0ZW0udGV4dCksXG4gICAgICAgICAgICApLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICB0ZXh0OiAnRXhhbXBsZXMnLFxuICAgICAgICBpdGVtczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHRleHQ6ICdFeGFtcGxlcyBPdmVydmlldycsXG4gICAgICAgICAgICBsaW5rOiAnL2V4YW1wbGVzJyxcbiAgICAgICAgICAgIGl0ZW1zOiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0ZXh0OiAnQmFzaWMgRXhhbXBsZSAoVml0ZSknLFxuICAgICAgICAgICAgICAgIGxpbms6ICcvZXhhbXBsZXMvI21vc2FpYy1leGFtcGxlLXZpdGUnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdGV4dDogJ0FJIEFuYWx5dGljcyAoTmV4dC5qcyknLFxuICAgICAgICAgICAgICAgIGxpbms6ICcvZXhhbXBsZXMjYWktcG93ZXJlZC1hbmFseXRpY3MtbmV4dC1qcycsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIF0sXG5cbiAgICBzb2NpYWxMaW5rczogW1xuICAgICAge2ljb246ICdnaXRodWInLCBsaW5rOiAnaHR0cHM6Ly9naXRodWIuY29tL3NxbHJvb21zL3NxbHJvb21zJ30sXG4gICAgXSxcbiAgfSxcbn0pO1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvaWx5YS9Xb3Jrc3BhY2Uvc3Fscm9vbXMvZG9jcy8udml0ZXByZXNzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvaWx5YS9Xb3Jrc3BhY2Uvc3Fscm9vbXMvZG9jcy8udml0ZXByZXNzL2dlbi1hcGktc2lkZWJhci50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvaWx5YS9Xb3Jrc3BhY2Uvc3Fscm9vbXMvZG9jcy8udml0ZXByZXNzL2dlbi1hcGktc2lkZWJhci50c1wiO2ltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7Z2xvYlN5bmN9IGZyb20gJ2dsb2InO1xuXG4vLyBUeXBlIGZvciBzaWRlYmFyIGl0ZW1zIGJhc2VkIG9uIHRoZSBzdHJ1Y3R1cmUgd2UndmUgc2VlblxuaW50ZXJmYWNlIFNpZGViYXJJdGVtIHtcbiAgdGV4dDogc3RyaW5nO1xuICBsaW5rPzogc3RyaW5nO1xuICBpdGVtcz86IFNpZGViYXJJdGVtW107XG4gIGNvbGxhcHNlZD86IGJvb2xlYW47XG59XG5cbmZ1bmN0aW9uIGZpbmRUeXBlRG9jU2lkZWJhcnMoYXBpRGlyOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIHJldHVybiBnbG9iU3luYygnKiovdHlwZWRvYy1zaWRlYmFyLmpzb24nLCB7XG4gICAgY3dkOiBhcGlEaXIsXG4gICAgYWJzb2x1dGU6IGZhbHNlLFxuICB9KTtcbn1cblxuZnVuY3Rpb24gY2xlYW51cExpbmtzKGl0ZW1zOiBTaWRlYmFySXRlbVtdKTogU2lkZWJhckl0ZW1bXSB7XG4gIHJldHVybiBpdGVtcy5tYXAoKGl0ZW0pID0+IHtcbiAgICBjb25zdCBjbGVhbmVkOiBTaWRlYmFySXRlbSA9IHsuLi5pdGVtfTtcblxuICAgIGlmIChjbGVhbmVkLmxpbmspIHtcbiAgICAgIGNsZWFuZWQubGluayA9IGNsZWFuZWQubGluay5yZXBsYWNlKCcvLi4vLi4vZG9jcycsICcnKTtcbiAgICB9XG5cbiAgICBpZiAoY2xlYW5lZC5pdGVtcykge1xuICAgICAgY2xlYW5lZC5pdGVtcyA9IGNsZWFudXBMaW5rcyhjbGVhbmVkLml0ZW1zKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY2xlYW5lZDtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGxvYWRTaWRlYmFyQ29udGVudChmaWxlUGF0aDogc3RyaW5nKTogU2lkZWJhckl0ZW1bXSB7XG4gIGNvbnN0IGNvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZVBhdGgsICd1dGYtOCcpO1xuICBjb25zdCBpdGVtcyA9IEpTT04ucGFyc2UoY29udGVudCk7XG4gIHJldHVybiBjbGVhbnVwTGlua3MoaXRlbXMpO1xufVxuXG5mdW5jdGlvbiBmbGF0dGVuQW5kQW5ub3RhdGVJdGVtcyhcbiAgaXRlbXM6IFNpZGViYXJJdGVtW10sXG4gIHBhY2thZ2VOYW1lOiBzdHJpbmcsXG4pOiBTaWRlYmFySXRlbVtdIHtcbiAgY29uc3QgcmVzdWx0OiBTaWRlYmFySXRlbVtdID0gW107XG5cbiAgZm9yIChjb25zdCBjYXRlZ29yeSBvZiBpdGVtcykge1xuICAgIGlmICghY2F0ZWdvcnkuaXRlbXMpIGNvbnRpbnVlO1xuXG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGNhdGVnb3J5Lml0ZW1zKSB7XG4gICAgICBsZXQgc3VmZml4ID0gJyc7XG4gICAgICBpZiAoY2F0ZWdvcnkudGV4dCA9PT0gJ1R5cGUgQWxpYXNlcycgfHwgY2F0ZWdvcnkudGV4dCA9PT0gJ0ludGVyZmFjZXMnKSB7XG4gICAgICAgIHN1ZmZpeCA9ICcgKHR5cGUpJztcbiAgICAgIH0gZWxzZSBpZiAoY2F0ZWdvcnkudGV4dCA9PT0gJ0VudW1lcmF0aW9ucycpIHtcbiAgICAgICAgc3VmZml4ID0gJyAoZW51bSknO1xuICAgICAgfVxuXG4gICAgICByZXN1bHQucHVzaCh7XG4gICAgICAgIHRleHQ6IGAke2l0ZW0udGV4dH0ke3N1ZmZpeH1gLFxuICAgICAgICBsaW5rOiBpdGVtLmxpbmssXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvLyBTb3J0IGFscGhhYmV0aWNhbGx5IGJ5IHRleHQgKGlnbm9yaW5nIHRoZSB0eXBlL2VudW0gc3VmZml4KVxuICByZXR1cm4gcmVzdWx0LnNvcnQoKGEsIGIpID0+IHtcbiAgICByZXR1cm4gYS50ZXh0LmxvY2FsZUNvbXBhcmUoYi50ZXh0KTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlQXBpU2lkZWJhcihcbiAgZG9jc0Rpcjogc3RyaW5nLFxuKTogTm9uTnVsbGFibGU8U2lkZWJhckl0ZW1bJ2l0ZW1zJ10+IHtcbiAgY29uc3QgYXBpRGlyID0gcGF0aC5qb2luKGRvY3NEaXIsICdhcGknKTtcbiAgY29uc3Qgc2lkZWJhckZpbGVzID0gZmluZFR5cGVEb2NTaWRlYmFycyhhcGlEaXIpO1xuXG4gIGNvbnN0IHBhY2thZ2VzOiBTaWRlYmFySXRlbVtdID0gW107XG5cbiAgZm9yIChjb25zdCBzaWRlYmFyRmlsZSBvZiBzaWRlYmFyRmlsZXMpIHtcbiAgICBjb25zb2xlLmxvZyhgR2VuZXJhdGluZyBzaWRlYmFyIGZvciAke3NpZGViYXJGaWxlfWApO1xuICAgIGNvbnN0IHBhY2thZ2VOYW1lID0gcGF0aC5kaXJuYW1lKHNpZGViYXJGaWxlKTtcbiAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGguam9pbihhcGlEaXIsIHNpZGViYXJGaWxlKTtcbiAgICBjb25zdCBjb250ZW50ID0gbG9hZFNpZGViYXJDb250ZW50KGZ1bGxQYXRoKTtcblxuICAgIHBhY2thZ2VzLnB1c2goe1xuICAgICAgdGV4dDogcGFja2FnZU5hbWUsXG4gICAgICBjb2xsYXBzZWQ6IHRydWUsXG4gICAgICBpdGVtczogZmxhdHRlbkFuZEFubm90YXRlSXRlbXMoY29udGVudCwgcGFja2FnZU5hbWUpLFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHBhY2thZ2VzO1xufVxuXG4vLyBHZW5lcmF0ZSB0aGUgY29tYmluZWQgc2lkZWJhclxuY29uc3QgZG9jc0RpciA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLicpO1xuY29uc3QgYXBpU2lkZWJhciA9IGdlbmVyYXRlQXBpU2lkZWJhcihkb2NzRGlyKTtcblxuLy8gRXhwb3J0IHRoZSBzaWRlYmFyIGZvciB1c2UgaW4gY29uZmlnLnRzXG5leHBvcnQgY29uc3QgYXBpU2lkZWJhckNvbmZpZyA9IGFwaVNpZGViYXI7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWtULFNBQVEsb0JBQW1COzs7QUNBVCxPQUFPLFFBQVE7QUFDblYsT0FBTyxVQUFVO0FBQ2pCLFNBQVEsZ0JBQWU7QUFGdkIsSUFBTSxtQ0FBbUM7QUFZekMsU0FBUyxvQkFBb0IsUUFBMEI7QUFDckQsU0FBTyxTQUFTLDJCQUEyQjtBQUFBLElBQ3pDLEtBQUs7QUFBQSxJQUNMLFVBQVU7QUFBQSxFQUNaLENBQUM7QUFDSDtBQUVBLFNBQVMsYUFBYSxPQUFxQztBQUN6RCxTQUFPLE1BQU0sSUFBSSxDQUFDLFNBQVM7QUFDekIsVUFBTSxVQUF1QixFQUFDLEdBQUcsS0FBSTtBQUVyQyxRQUFJLFFBQVEsTUFBTTtBQUNoQixjQUFRLE9BQU8sUUFBUSxLQUFLLFFBQVEsZUFBZSxFQUFFO0FBQUEsSUFDdkQ7QUFFQSxRQUFJLFFBQVEsT0FBTztBQUNqQixjQUFRLFFBQVEsYUFBYSxRQUFRLEtBQUs7QUFBQSxJQUM1QztBQUVBLFdBQU87QUFBQSxFQUNULENBQUM7QUFDSDtBQUVBLFNBQVMsbUJBQW1CLFVBQWlDO0FBQzNELFFBQU0sVUFBVSxHQUFHLGFB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
