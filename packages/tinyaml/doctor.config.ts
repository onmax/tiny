import { defineDoctorConfig } from "vite-doctor/config";
import tinyaml from "./src/doctor.ts";

export default defineDoctorConfig({
  extends: ["auto", "tinyaml/recommended"],
  extensions: [
    tinyaml({
      // test/mapper/errors holds YAML that is invalid on purpose, for the mapper's error tests.
      exclude: ["**/node_modules/**", "**/dist/**", ".cache/**", "test/mapper/errors/**"],
    }),
  ],
});
