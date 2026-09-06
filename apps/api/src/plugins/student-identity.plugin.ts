// apps/api/src/plugins/student-identity.plugin.ts
import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { studentRoutes } from "../routes/student.route";

async function studentIdentityPlugin(app: FastifyInstance) {
    // Register student routes under both /api and root prefixes for compatibility
    app.register(studentRoutes);
    app.register(studentRoutes, { prefix: "/api" });
}

export default fp(studentIdentityPlugin, { name: "studentIdentityPlugin" });
