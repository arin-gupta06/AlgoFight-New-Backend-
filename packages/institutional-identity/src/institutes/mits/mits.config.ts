// packages/institutional-identity/src/institutes/mits/mits.config.ts
import { InstituteConfig } from "../../core/types";
import { MITS_DOMAIN, MITS_INSTITUTE_ID, MITS_INSTITUTE_NAME } from "./mits.constants";
import { MitsIdentityParser } from "./mits.parser";
import { MitsAcademicRules } from "./mits.rules";

export const mitsInstituteConfig: InstituteConfig = {
    id: MITS_INSTITUTE_ID,
    name: MITS_INSTITUTE_NAME,
    domain: MITS_DOMAIN,
    status: "ACTIVE",
    identityParser: new MitsIdentityParser(),
    academicRules: new MitsAcademicRules(),
};
