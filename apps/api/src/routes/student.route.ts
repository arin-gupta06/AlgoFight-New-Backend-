// apps/api/src/routes/student.route.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { defaultStudentIdentityService } from "@algofight/institutional-identity";
import { UserController } from "../controllers/user.controller";
import { requireAuth } from "../plugins/auth.plugin";

const userController = new UserController();

export async function studentRoutes(app: FastifyInstance) {
    /**
     * Pre-auth live resolution / validation endpoint
     * Used by the frontend as the student types their email
     */
    app.post("/student/resolve", async (request: FastifyRequest, reply: FastifyReply) => {
        const body = request.body as { email?: string };
        const email = body?.email?.trim();

        if (!email) {
            return reply.status(400).send({
                error: "BAD_REQUEST",
                message: "Email address is required.",
            });
        }

        const validation = defaultStudentIdentityService.validateEmail(email);

        if (!validation.isSupportedInstitute) {
            return reply.send({
                isSupportedInstitute: false,
                message: "This institution is not currently supported by AlgoFight.",
            });
        }

        if (!validation.isValidFormat) {
            return reply.send({
                isSupportedInstitute: true,
                instituteName: validation.instituteName,
                isValidFormat: false,
                message: validation.error || `Invalid institutional email format for ${validation.instituteName}.`,
            });
        }

        // Valid institute and format -> Provide preview
        try {
            const resolved = defaultStudentIdentityService.resolveFromEmail(email);
            return reply.send({
                isSupportedInstitute: true,
                instituteName: validation.instituteName,
                isValidFormat: true,
                preview: resolved.isInstitutional ? {
                    institute: resolved.institute,
                    identity: resolved.identity,
                    academicProfile: resolved.academicProfile,
                } : null,
            });
        } catch (err: any) {
            return reply.status(400).send({
                isSupportedInstitute: true,
                instituteName: validation.instituteName,
                isValidFormat: false,
                message: err.message,
            });
        }
    });

    /**
     * Authenticated Student Sync & Registration Route
     * Automatically establishes institutional identity from verified email
     */
    app.post("/student/sync", { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const body = request.body as any;
        const authenticatedUser = request.user!;
        const verifiedEmail = authenticatedUser.email || body.email;

        if (!verifiedEmail) {
            return reply.status(400).send({
                error: "VERIFIED_EMAIL_REQUIRED",
                message: "A verified email address is required for institutional student identity establishment.",
            });
        }

        const resolution = defaultStudentIdentityService.resolveFromEmail(verifiedEmail);

        if (!resolution.isInstitutional) {
            return reply.status(400).send({
                error: "UNSUPPORTED_INSTITUTION",
                message: resolution.reason || "The provided verified email does not belong to a supported institutional domain.",
            });
        }

        const { institute, identity, academicProfile } = resolution;

        // Upsert user with institutional fields
        const user = await userController.syncUser({
            id: authenticatedUser.id,
            email: verifiedEmail,
            username: authenticatedUser.username || body.username || verifiedEmail.split("@")[0],
            displayName: body.displayName || authenticatedUser.username,
            githubUrl: body.githubUrl,
            linkedinUrl: body.linkedinUrl,
            userType: "STUDENT",
            institutionName: institute.name,
            institutionId: institute.id,
            institutionDomain: institute.domain,
            department: identity.branchName,
            branch: identity.branch,
            admissionYear: identity.admissionYear,
            enrollmentNumber: identity.enrollmentNumber,
            studentIdentityMetadata: identity.instituteSpecificIdentifiers,
        });

        return reply.send({
            ...user,
            studentIdentity: identity,
            academicProfile,
        });
    });

    /**
     * Get Student Academic Profile by User ID
     */
    app.get("/student/profile/:id", async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const userProfile = await userController.getUserById(id, (request as any).user);

        if (!userProfile) {
            return reply.status(404).send({
                error: "NOT_FOUND",
                message: "User profile not found.",
            });
        }

        return reply.send(userProfile);
    });
}
