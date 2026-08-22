import { assembleSyncpress } from "./src/assembly.ts";

export default {
  assemble: assembleSyncpress,
  title: "Syncpress",
  design: {
    version: 1,
    documents: [
      new URL("./design/types.md", import.meta.url),
      new URL("./design/application.md", import.meta.url),
    ],
  },
};
