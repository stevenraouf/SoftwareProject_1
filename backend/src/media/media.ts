import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Request, Response } from "express";
import type {} from "multer";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { Db, oid, same } from "../database.js";
import { Actor } from "../common.js";
import { actorOf, Public } from "../auth/auth.js";
import { CommunityService } from "../community/community.js";
import { ItinerariesService } from "../itineraries/itineraries.js";
import { manageProvider } from "../flights/flights.js";

export function validateImage(buffer: Buffer, declaredMime: string) {
  if (!buffer.length || buffer.length > 5 * 1024 * 1024)
    throw new BadRequestException("Images must be at most 5 MB");
  try {
    if (
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      declaredMime === "image/png"
    ) {
      if (
        buffer.length < 24 ||
        buffer.readUInt32BE(16) * buffer.readUInt32BE(20) > 20_000_000
      )
        throw new Error("Image dimensions too large");
      const image = PNG.sync.read(buffer, { checkCRC: true });
      if (!image.width || !image.height) throw new Error("Invalid image");
      return { mime: "image/png", ext: "png" };
    }
    if (
      buffer[0] === 255 &&
      buffer[1] === 216 &&
      buffer[2] === 255 &&
      declaredMime === "image/jpeg"
    ) {
      jpeg.decode(buffer, {
        maxResolutionInMP: 20,
        maxMemoryUsageInMB: 128,
        tolerantDecoding: false,
      });
      return { mime: "image/jpeg", ext: "jpg" };
    }
  } catch {
    throw new BadRequestException(
      "Image is corrupt or exceeds safe decoding limits",
    );
  }
  throw new BadRequestException(
    "Only valid JPG and PNG files with matching content types are supported",
  );
}
@Injectable()
export class MediaService {
  readonly storage = resolve(process.env.STORAGE_PATH || "./storage");
  constructor(
    readonly db: Db,
    readonly community: CommunityService,
    readonly itineraries: ItinerariesService,
  ) {}
  async parent(
    type: string,
    id: string,
    actor?: Actor,
    write = false,
    session?: any,
  ): Promise<{ doc: any; child: any; field: string; limit: number }> {
    if (type === "post") {
      const doc = write
        ? await this.community.postOwn(actor!, id)
        : await this.community.postAccess(actor, id);
      return {
        doc: session ? await this.db.get("Post", doc._id, session) : doc,
        child: null,
        field: "imageIds",
        limit: 5,
      };
    }
    if (type === "activity") {
      const found = await this.db
        .model("Itinerary")
        .findOne({ "days.activities._id": oid(id) })
        .session(session ?? null);
      if (!found) throw new NotFoundException("Activity not found");
      if (write) await this.itineraries.own(actor!, found._id, session);
      else await this.itineraries.access(actor, String(found._id));
      return {
        doc: found,
        child: found.days
          .flatMap((d: any) => d.activities)
          .find((a: any) => same(a._id, id)),
        field: "imageIds",
        limit: 5,
      };
    }
    if (type === "hotel" || type === "airline") {
      const doc = await this.db.get("Provider", id, session);
      if (doc.type !== type) throw new NotFoundException("Provider not found");
      if (write) manageProvider(actor!, doc);
      return {
        doc,
        child: null,
        field: type === "airline" ? "logoId" : "imageIds",
        limit: type === "airline" ? 1 : 5,
      };
    }
    throw new BadRequestException("Unsupported media parent");
  }
  async upload(
    actor: Actor,
    type: string,
    id: string,
    file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("An image file is required");
    const format = validateImage(file.buffer, file.mimetype);
    const filename = `${randomUUID()}.${format.ext}`;
    await this.parent(type, id, actor, true);
    await mkdir(this.storage, { recursive: true });
    await writeFile(resolve(this.storage, filename), file.buffer, {
      flag: "wx",
    });
    try {
      return await this.db.transaction(async (session) => {
        const parent = await this.parent(type, id, actor, true, session);
        const target = parent.child || parent.doc;
        const count =
          parent.limit === 1
            ? Number(!!target[parent.field])
            : target[parent.field].length;
        if (count >= parent.limit)
          throw new BadRequestException(
            `Maximum ${parent.limit} image(s) reached; remove one before uploading`,
          );
        const [media] = await this.db.model("Media").create(
          [
            {
              userId: oid(actor.id),
              resourceType: type,
              resourceId: oid(id),
              filename,
              mime: format.mime,
              size: file.size,
            },
          ],
          { session },
        );
        if (parent.limit === 1) target[parent.field] = media._id;
        else target[parent.field].push(media._id);
        await parent.doc.save({ session });
        return {
          id: media.id,
          url: `/api/media/${media.id}`,
          mime: media.mime,
          size: media.size,
        };
      });
    } catch (e) {
      await unlink(resolve(this.storage, filename)).catch(() => undefined);
      throw e;
    }
  }
  async remove(actor: Actor, type: string, id: string, mediaId: string) {
    await this.db.transaction(async (session) => {
      const parent = await this.parent(type, id, actor, true, session);
      const target = parent.child || parent.doc;
      const media = await this.db.get("Media", mediaId, session);
      if (media.resourceType !== type || !same(media.resourceId, id))
        throw new NotFoundException("Image does not belong to this resource");
      if (parent.limit === 1) target[parent.field] = undefined;
      else target[parent.field].pull(oid(mediaId));
      await parent.doc.save({ session });
      await media.deleteOne({ session });
    });
    // Files are immutable and may be shared by independent clone media records. Offline GC can remove unreferenced files.
    return { message: "Image removed" };
  }
  async serve(actor: Actor | undefined, id: string, res: Response) {
    const media = await this.db.get("Media", id);
    await this.parent(media.resourceType, String(media.resourceId), actor);
    if (!/^[a-f0-9-]+\.(png|jpg)$/.test(media.filename))
      throw new NotFoundException("Image not found");
    res.setHeader("Cache-Control", "private, no-store");
    res.type(media.mime);
    res.sendFile(resolve(this.storage, media.filename), { dotfiles: "allow" });
  }
}
const upload = () =>
  UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
    }),
  );
const imageBody = () =>
  ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  });
@ApiTags("Media")
@ApiCookieAuth()
@Controller()
export class MediaController {
  constructor(readonly media: MediaService) {}
  @Get("media/:id")
  @Public()
  @ApiOperation({
    summary: "GEN-08 Fetch image after checking parent visibility",
  })
  get(@Req() r: Request, @Param("id") id: string, @Res() res: Response) {
    return this.media.serve(actorOf(r), id, res);
  }
  @Post("posts/:id/images")
  @upload()
  @ApiConsumes("multipart/form-data")
  @imageBody()
  @ApiOperation({ summary: "BLG-10 GEN-08 Upload a post image" })
  post(
    @Req() r: Request,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.media.upload(actorOf(r), "post", id, file);
  }
  @Delete("posts/:id/images/:imageId")
  @ApiOperation({ summary: "BLG-10 Remove a post image" })
  removePost(
    @Req() r: Request,
    @Param("id") id: string,
    @Param("imageId") img: string,
  ) {
    return this.media.remove(actorOf(r), "post", id, img);
  }
  @Post("activities/:id/images")
  @upload()
  @ApiConsumes("multipart/form-data")
  @imageBody()
  @ApiOperation({ summary: "ITN-12 GEN-08 Upload an activity image" })
  activity(
    @Req() r: Request,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.media.upload(actorOf(r), "activity", id, file);
  }
  @Delete("activities/:id/images/:imageId")
  @ApiOperation({ summary: "ITN-12 Remove activity image" })
  removeActivity(
    @Req() r: Request,
    @Param("id") id: string,
    @Param("imageId") img: string,
  ) {
    return this.media.remove(actorOf(r), "activity", id, img);
  }
  @Post("hotels/:id/images")
  @upload()
  @ApiConsumes("multipart/form-data")
  @imageBody()
  @ApiOperation({ summary: "HTL-01 GEN-08 Upload assigned hotel photo" })
  hotel(
    @Req() r: Request,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.media.upload(actorOf(r), "hotel", id, file);
  }
  @Delete("hotels/:id/images/:imageId")
  @ApiOperation({ summary: "HTL-01 GEN-08 Remove hotel photo" })
  removeHotel(
    @Req() r: Request,
    @Param("id") id: string,
    @Param("imageId") img: string,
  ) {
    return this.media.remove(actorOf(r), "hotel", id, img);
  }
  @Post("airlines/:id/logo")
  @upload()
  @ApiConsumes("multipart/form-data")
  @imageBody()
  @ApiOperation({ summary: "FLT-01 GEN-08 Upload assigned airline logo" })
  airline(
    @Req() r: Request,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.media.upload(actorOf(r), "airline", id, file);
  }
  @Delete("airlines/:id/logo/:imageId")
  @ApiOperation({ summary: "FLT-01 GEN-08 Remove airline logo" })
  removeLogo(
    @Req() r: Request,
    @Param("id") id: string,
    @Param("imageId") img: string,
  ) {
    return this.media.remove(actorOf(r), "airline", id, img);
  }
}
