import { and, eq } from "drizzle-orm";

import { getDb } from "../../../db";
import { users } from "../../../db/schema";


const ORGANIZATION_ID =
  "org-resolveops-demo";


export async function GET() {
  try {
    const db = getDb();


    const technicians = await db
      .select({
        id:
          users.id,

        fullName:
          users.fullName,

        email:
          users.email,
      })
      .from(users)
      .where(
        and(
          eq(
            users.organizationId,
            ORGANIZATION_ID,
          ),
          eq(
            users.role,
            "technician",
          ),
        ),
      );


    return Response.json({
      technicians,
    });
  } catch (error) {
    console.error(
      "Unable to load technicians",
      error,
    );


    return Response.json(
      {
        error:
          "Unable to load technicians",
      },
      {
        status: 500,
      },
    );
  }
}
