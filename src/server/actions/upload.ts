"use server";

import type { ActionResult } from "@/server/contract";
import { uploadImage as uploadImageService } from "@/server/services/upload";
import { withActor } from "./_run";

export async function uploadImage(formData: FormData): Promise<ActionResult<{ attachmentId: string; url: string }>> {
  return withActor([], (actor) => uploadImageService(actor, { file: formData.get("file"), kind: formData.get("kind") }));
}
