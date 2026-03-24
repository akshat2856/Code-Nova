"use server";

import { db } from "@/lib/db";
import { currentUser } from "@/modules/auth/actions";
import { revalidatePath } from "next/cache";

export const toggleStarMarked = async (
  playgroundId: string,
  isChecked: boolean
) => {
  const user = await currentUser();
  const userId = user?.id;
  if (!userId) {
    throw new Error("User Id is Required");
  }

  try {
    if (isChecked) {
      await db.starMark.create({
        data: {
          userId: userId!,
          playgroundId,
          isMarked: isChecked,
        },
      });
    } else {
        await db.starMark.delete({
        where: {
          userId_playgroundId: {
            userId,
            playgroundId: playgroundId,

          },
        },
      });
    }

     revalidatePath("/dashboard");
    return { success: true, isMarked: isChecked };
  } catch (error) {
       console.error("Error updating problem:", error);
    return { success: false, error: "Failed to update problem" };
  }
};

export const getAllPlaygroundForUser = async () => {
  const user = await currentUser();
  const userId = user?.id;

  if (!userId) {
    return [];
  }

  try {
    const rawPlaygroundResult = (await db.$runCommandRaw({
      find: "Playground",
      filter: { userId },
      projection: {
        _id: 1,
        title: 1,
        description: 1,
        template: 1,
        createdAt: 1,
      },
    })) as {
      cursor?: {
        firstBatch?: Array<{
          _id?: string | { $oid?: string };
          title?: string;
          description?: string | null;
          template?: string;
          createdAt?: string | Date | { $date?: string | number } | null;
        }>;
      };
    };

    const starMarks = await db.starMark.findMany({
      where: { userId },
      select: { playgroundId: true, isMarked: true },
    });

    const markByPlaygroundId = new Map(
      starMarks.map((mark) => [mark.playgroundId, mark.isMarked])
    );

    const playground = (rawPlaygroundResult.cursor?.firstBatch ?? []).map(
      (item) => {
        const itemId =
          typeof item._id === "string"
            ? item._id
            : item._id?.$oid || "";

        let createdAt = new Date();
        const rawCreatedAt = item.createdAt;

        if (rawCreatedAt instanceof Date) {
          createdAt = rawCreatedAt;
        } else if (typeof rawCreatedAt === "string") {
          const parsed = new Date(rawCreatedAt);
          if (!Number.isNaN(parsed.getTime())) {
            createdAt = parsed;
          }
        } else if (
          rawCreatedAt &&
          typeof rawCreatedAt === "object" &&
          "$date" in rawCreatedAt
        ) {
          const parsed = new Date(rawCreatedAt.$date as string | number);
          if (!Number.isNaN(parsed.getTime())) {
            createdAt = parsed;
          }
        }

        return {
          id: itemId,
          title: item.title || "Untitled",
          description: item.description || "",
          template: item.template || "REACT",
          createdAt,
          user: {
            name: user.name || "User",
            image: user.image || "/placeholder.svg",
          },
          Starmark: [
            {
              isMarked: markByPlaygroundId.get(itemId) ?? false,
            },
          ],
        };
      }
    );

    return playground;
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const createPlayground = async (data: {
  title: string;
  template: "REACT" | "NEXTJS" | "EXPRESS" | "VUE" | "HONO" | "ANGULAR";
  description?: string;
}) => {
  const user = await currentUser();
  const userId = user?.id;

  if (!userId) {
    throw new Error("User Id is Required");
  }

  const { template, title, description } = data;

  

  try {
    const playground = await db.playground.create({
      data: {
        title: title,
        description: description,
        template: template,
        userId,
      },
    });

    return playground;
  } catch (error) {
    console.log(error);
  }
};

export const deleteProjectById = async (id: string) => {
  const user = await currentUser();
  const userId = user?.id;

  if (!userId) {
    throw new Error("User Id is Required");
  }

  try {
    await db.starMark.deleteMany({
      where: {
        playgroundId: id,
      },
    });

    const deleted = await db.playground.deleteMany({
      where: {
        id,
        userId,
      },
    });

    if (deleted.count === 0) {
      throw new Error("Project not found or not authorized to delete");
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error deleting project:", error);
    throw new Error("Failed to delete project");
  }
};

export const editProjectById = async (
  id: string,
  data: { title: string; description: string }
) => {
  try {
    await db.playground.update({
      where: {
        id,
      },
      data: data,
    });
    revalidatePath("/dashboard");
  } catch (error) {
    console.log(error);
  }
};

export const duplicateProjectById = async (id: string) => {
  try {
    const originalPlayground = await db.playground.findUnique({
      where: { id },
      // todo: add tempalte files
    });
    if (!originalPlayground) {
      throw new Error("Original playground not found");
    }

    const duplicatedPlayground = await db.playground.create({
      data: {
        title: `${originalPlayground.title} (Copy)`,
        description: originalPlayground.description,
        template: originalPlayground.template,
        userId: originalPlayground.userId,

        // todo: add template files
      },
    });

    revalidatePath("/dashboard");
    return duplicatedPlayground;
  } catch (error) {
    console.error("Error duplicating project:", error);
  }
};