import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { HttpError, requireAuthenticatedCompany } from "../../_lib/auth.js";
import { getR2Config } from "../../_lib/r2.js";

const supportedExtension = /\.(?:jpe?g|png|webp|mp4)$/i;

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "GET")
    return response.status(405).json({ error: "Método não permitido." });
  try {
    const company = await requireAuthenticatedCompany(request);
    const { client, bucket, publicBaseUrl } = getR2Config();
    const prefix = `tv/${company.companyId}/`;
    const contents: Array<{
      Key?: string;
      Size?: number;
      LastModified?: Date;
    }> = [];
    let continuationToken: string | undefined;
    do {
      const listed = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        }),
      );
      contents.push(...(listed.Contents ?? []));
      continuationToken = listed.IsTruncated
        ? listed.NextContinuationToken
        : undefined;
    } while (continuationToken);
    const { data: registered, error } = await company.supabase
      .from("tv_media")
      .select("storage_key")
      .eq("company_id", company.companyId)
      .not("storage_key", "is", null);
    if (error) throw error;
    const registeredKeys = new Set(
      (registered ?? []).map((item) => item.storage_key),
    );
    const objects = contents.flatMap((object) => {
      const key = object.Key;
      if (!key || !supportedExtension.test(key) || registeredKeys.has(key))
        return [];
      return [
        {
          key,
          filename: decodeURIComponent(key.split("/").pop() ?? key),
          publicUrl: `${publicBaseUrl}/${key}`,
          size: object.Size ?? 0,
          lastModified: object.LastModified?.toISOString() ?? null,
          type: /\.mp4$/i.test(key) ? ("video" as const) : ("image" as const),
        },
      ];
    });
    return response.status(200).json({ objects, total: objects.length });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 503;
    return response
      .status(status)
      .json({
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível listar as mídias do R2.",
      });
  }
}
