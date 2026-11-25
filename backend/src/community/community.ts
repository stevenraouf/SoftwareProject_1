import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { Db, oid, same } from "../database.js";
import {
  Actor,
  escapeRegex,
  pageNumber,
  paginated,
  definedFields,
} from "../common.js";
import {
  AttachItineraryDto,
  CommentDto,
  ConfirmDto,
  PageDto,
  PatchPostDto,
  PatchReviewDto,
  PostDto,
  PostQueryDto,
  ReplyDto,
  ReportDto,
  ReviewDto,
} from "../dto.js";
import { actorOf, Public, Roles } from "../auth/auth.js";
import { BookingsService } from "../bookings/bookings.js";
import { ItinerariesService } from "../itineraries/itineraries.js";
import { manageProvider } from "../flights/flights.js";
import { Ops } from "../ops.js";

@Injectable()
export class CommunityService {
  constructor(
    readonly db: Db,
    readonly bookings: BookingsService,
    readonly itineraries: ItinerariesService,
    readonly ops: Ops,
  ) {}
  async publicAuthor(id: any) {
    return this.ops.publicAuthor(id);
  }
  async postAccess(actor: Actor | undefined, id: string) {
    const p = await this.db.get("Post", id);
    const author = await this.db.get("User", p.userId);
    if (actor && (same(p.userId, actor.id) || actor.role === "Admin")) return p;
    if (p.status !== "Published" || p.hidden || author.status === "Deactivated")
      throw new NotFoundException("Post not found");
    return p;
  }
  async postOwn(actor: Actor, id: string) {
    const p = await this.db.get("Post", id);
    if (!same(p.userId, actor.id))
      throw new ForbiddenException("Post belongs to another author");
    return p;
  }
  async create(actor: Actor, dto: PostDto) {
    return this.db.model("Post").create({
      ...dto,
      tags: dto.tags?.map((t) => t.trim()),
      userId: oid(actor.id),
    });
  }
  async edit(actor: Actor, id: string, dto: PatchPostDto) {
    const p = await this.postOwn(actor, id);
    Object.assign(p, definedFields(dto));
    return p.save();
  }
  async removePost(actor: Actor, id: string) {
    const p = await this.postOwn(actor, id);
    await this.deleteContent("post", p._id);
    return { message: "Post deleted" };
  }
  async postDetail(actor: Actor | undefined, id: string, page: number) {
    const p = await this.postAccess(actor, id);
    const comments = await paginated(
      this.db.model("Comment"),
      {
        postId: p._id,
        ...(!actor || actor.role !== "Admin"
          ? {
              $or: [
                { hidden: false },
                ...(actor ? [{ userId: oid(actor.id) }] : []),
              ],
            }
          : {}),
      },
      page,
      { createdAt: 1 },
    );
    const author = await this.publicAuthor(p.userId);
    const likes = this.db.model("Like");
    const [likeCount, ownLike] = await Promise.all([
      likes.countDocuments({ postId: p._id }),
      actor ? likes.exists({ postId: p._id, userId: oid(actor.id) }) : null,
    ]);
    const post = p.toObject();
    const attachedItinerary = p.itineraryId
      ? await this.itineraries
          .access(actor, String(p.itineraryId))
          .then((d) => ({ id: d.id, title: d.title }))
          .catch((error) => {
            if (error instanceof NotFoundException) return null;
            throw error;
          })
      : null;
    if (!attachedItinerary) delete post.itineraryId;
    return {
      ...post,
      author,
      likeCount,
      likedByMe: Boolean(ownLike),
      comments: {
        ...comments,
        items: await Promise.all(
          comments.items.map(async (c: any) => ({
            ...c,
            author: await this.publicAuthor(c.userId),
          })),
        ),
      },
      attachedItinerary,
    };
  }
  async list(q: PostQueryDto) {
    const authors = await this.db
      .model("User")
      .find({ status: { $ne: "Deactivated" } })
      .select("_id name")
      .lean();
    const filter: any = {
      status: "Published",
      hidden: false,
      userId: { $in: authors.map((a: any) => a._id) },
    };
    if (q.tag) filter.tags = q.tag;
    if (q.q) {
      const rx = new RegExp(escapeRegex(q.q), "i");
      filter.$or = [
        { title: rx },
        { tags: rx },
        {
          userId: {
            $in: authors
              .filter((a: any) => rx.test(a.name))
              .map((a: any) => a._id),
          },
        },
      ];
    }
    const posts = await this.db.model("Post").aggregate([
      { $match: filter },
      {
        $lookup: {
          from: this.db.model("Like").collection.name,
          localField: "_id",
          foreignField: "postId",
          as: "_likes",
        },
      },
      {
        $lookup: {
          from: this.db.model("Comment").collection.name,
          let: { pid: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$postId", "$$pid"] },
                    { $eq: ["$hidden", false] },
                  ],
                },
              },
            },
          ],
          as: "_comments",
        },
      },
      {
        $addFields: {
          likeCount: { $size: "$_likes" },
          commentCount: { $size: "$_comments" },
          interactionScore: {
            $add: [{ $size: "$_likes" }, { $size: "$_comments" }],
          },
        },
      },
      { $sort: { interactionScore: -1, createdAt: -1, _id: 1 } },
      { $project: { _likes: 0, _comments: 0 } },
    ]);
    const p = pageNumber(q.page);
    return {
      items: posts.slice((p - 1) * 10, p * 10).map((post: any) => ({
        id: post._id,
        title: post.title,
        author: authors.find((a: any) => same(a._id, post.userId))?.name,
        date: post.createdAt,
        excerpt: post.body.slice(0, 200),
        tags: post.tags,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        interactionScore: post.interactionScore,
      })),
      page: p,
      pageSize: 10,
      total: posts.length,
      pages: Math.ceil(posts.length / 10),
    };
  }
  async mine(actor: Actor, page: number) {
    const data = await paginated(
      this.db.model("Post"),
      { userId: oid(actor.id) },
      page,
    );
    return {
      ...data,
      items: await Promise.all(
        data.items.map(async (p: any) => ({
          ...p,
          likeCount: await this.db
            .model("Like")
            .countDocuments({ postId: p._id }),
          commentCount: await this.db
            .model("Comment")
            .countDocuments({ postId: p._id }),
        })),
      ),
    };
  }
  async comment(actor: Actor, id: string, dto: CommentDto) {
    const p = await this.postAccess(actor, id);
    if (p.status !== "Published")
      throw new BadRequestException("Comments require a published post");
    return this.db
      .model("Comment")
      .create({ postId: p._id, userId: oid(actor.id), body: dto.body });
  }
  async editComment(actor: Actor, id: string, dto?: CommentDto) {
    const c = await this.db.get("Comment", id);
    if (!same(c.userId, actor.id))
      throw new ForbiddenException("Comment belongs to another user");
    if (dto) {
      c.body = dto.body;
      return c.save();
    }
    await c.deleteOne();
    return { message: "Comment deleted" };
  }
  async like(actor: Actor, id: string, add: boolean) {
    const p = await this.postAccess(actor, id);
    if (p.status !== "Published")
      throw new BadRequestException("Likes require a published post");
    if (add)
      await this.db
        .model("Like")
        .updateOne(
          { postId: p._id, userId: oid(actor.id) },
          { $setOnInsert: { postId: p._id, userId: oid(actor.id) } },
          { upsert: true },
        );
    else
      await this.db
        .model("Like")
        .deleteOne({ postId: p._id, userId: oid(actor.id) });
    return {
      likeCount: await this.db.model("Like").countDocuments({ postId: p._id }),
    };
  }
  async author(id: string, page: number) {
    const user = await this.db.get("User", id);
    if (user.status === "Deactivated")
      throw new NotFoundException("Author not found");
    return {
      author: await this.publicAuthor(id),
      posts: await paginated(
        this.db.model("Post"),
        { userId: user._id, status: "Published", hidden: false },
        page,
        { createdAt: -1 },
        { itineraryId: 0 },
      ),
      itineraries: await paginated(
        this.db.model("Itinerary"),
        { userId: user._id, visibility: "Public", hidden: false },
        page,
        { createdAt: -1 },
        { _id: 1, title: 1, countries: 1, startDate: 1 },
      ),
    };
  }
  async attach(actor: Actor, id: string, dto: AttachItineraryDto) {
    const p = await this.postOwn(actor, id);
    if (dto.itineraryId) {
      const itinerary = await this.itineraries.access(actor, dto.itineraryId);
      if (itinerary.visibility !== "Public")
        throw new BadRequestException(
          "Only a public itinerary can be attached to a post",
        );
      p.itineraryId = itinerary._id;
    } else p.itineraryId = undefined;
    return p.save();
  }
  async ratings(hotelId: any, session?: any) {
    const [row] = await this.db
      .model("Review")
      .aggregate([
        { $match: { hotelId: oid(String(hotelId)), hidden: false } },
        {
          $group: {
            _id: null,
            average: { $avg: "$rating" },
            count: { $sum: 1 },
          },
        },
      ])
      .session(session ?? null);
    await this.db.model("Provider").updateOne(
      { _id: hotelId },
      {
        $set: {
          averageRating: row?.average || 0,
          ratingCount: row?.count || 0,
        },
      },
      { session },
    );
  }
  async review(actor: Actor, bookingId: string, dto: ReviewDto) {
    await this.bookings.complete();
    return this.db.transaction(async (session) => {
      const b = await this.bookings.own(actor, bookingId, session);
      if (b.type !== "hotel" || b.status !== "Completed")
        throw new BadRequestException(
          "One review is allowed only after a completed hotel stay",
        );
      const [review] = await this.db.model("Review").create(
        [
          {
            bookingId: b._id,
            hotelId: oid(b.snapshot.hotelId),
            userId: b.userId,
            ...dto,
          },
        ],
        { session },
      );
      await this.ratings(review.hotelId, session);
      return review;
    });
  }
  async editReview(actor: Actor, id: string, dto?: PatchReviewDto) {
    return this.db.transaction(async (session) => {
      const review = await this.db.get("Review", id, session);
      if (!same(review.userId, actor.id))
        throw new ForbiddenException("Review belongs to another user");
      if (dto) {
        Object.assign(review, definedFields(dto));
        await review.save({ session });
      } else await review.deleteOne({ session });
      await this.ratings(review.hotelId, session);
      return dto ? review : { message: "Review deleted" };
    });
  }
  async reviews(hotelId: string, page: number, actor?: Actor) {
    const hotel = await this.db.get("Provider", hotelId);
    if (hotel.type !== "hotel") throw new BadRequestException("Not a hotel");
    const filter: any = { hotelId: hotel._id };
    if (actor?.role !== "Admin")
      filter.$or = [
        { hidden: false },
        ...(actor ? [{ userId: oid(actor.id) }] : []),
      ];
    const data = await paginated(this.db.model("Review"), filter, page);
    return {
      ...data,
      averageRating: hotel.averageRating,
      ratingCount: hotel.ratingCount,
      items: await Promise.all(
        data.items.map(async (r: any) => {
          if (actor?.role !== "Admin" && !same(r.userId, actor?.id))
            delete r.bookingId;
          return { ...r, author: await this.publicAuthor(r.userId) };
        }),
      ),
    };
  }
  async reply(actor: Actor, id: string, dto: ReplyDto) {
    const review = await this.db.get("Review", id);
    const hotel = await this.db.get("Provider", review.hotelId);
    manageProvider(actor, hotel);
    review.reply = dto.body;
    return review.save();
  }
  contentModel(type: string) {
    const model = {
      post: "Post",
      comment: "Comment",
      review: "Review",
      itinerary: "Itinerary",
    }[type];
    if (!model) throw new BadRequestException("Unsupported content type");
    return model;
  }
  async report(actor: Actor, dto: ReportDto) {
    if (dto.contentType === "post") await this.postAccess(actor, dto.contentId);
    else if (dto.contentType === "itinerary")
      await this.itineraries.access(actor, dto.contentId);
    else {
      const c = await this.db.get(
        this.contentModel(dto.contentType),
        dto.contentId,
      );
      if (c.hidden && !same(c.userId, actor.id))
        throw new NotFoundException("Content not found");
      if (dto.contentType === "comment")
        await this.postAccess(actor, String(c.postId));
    }
    return this.db.model("Report").create({ ...dto, userId: oid(actor.id) });
  }
  async deleteContent(type: string, id: any, session?: any) {
    const doc = await this.db.get(this.contentModel(type), id, session);
    await doc.deleteOne({ session });
    if (type === "post") {
      await this.db
        .model("Comment")
        .deleteMany({ postId: doc._id }, { session });
      await this.db.model("Like").deleteMany({ postId: doc._id }, { session });
    }
    if (type === "review") await this.ratings(doc.hotelId, session);
  }
}
@ApiTags("Blog")
@ApiCookieAuth()
@Controller("posts")
export class PostsController {
  constructor(readonly community: CommunityService) {}
  @Get("mine")
  @Roles("User")
  @ApiOperation({ summary: "BLG-03 List own posts including drafts" })
  mine(@Req() r: Request, @Query() q: PageDto) {
    return this.community.mine(actorOf(r), q.page);
  }
  @Get()
  @Public()
  @ApiOperation({
    summary: "BLG-02 BLG-09 Search published posts by interaction score",
  })
  list(@Query() q: PostQueryDto) {
    return this.community.list(q);
  }
  @Post()
  @Roles("User")
  @ApiOperation({ summary: "BLG-01 BLG-08 Create draft or published post" })
  create(@Req() r: Request, @Body() d: PostDto) {
    return this.community.create(actorOf(r), d);
  }
  @Get(":id")
  @Public()
  @ApiOperation({ summary: "BLG-02 Read published post or own draft" })
  get(@Req() r: Request, @Param("id") id: string, @Query() q: PageDto) {
    return this.community.postDetail(actorOf(r), id, q.page);
  }
  @Patch(":id")
  @Roles("User")
  @ApiOperation({ summary: "BLG-04 BLG-08 Edit own post and tags" })
  patch(@Req() r: Request, @Param("id") id: string, @Body() d: PatchPostDto) {
    return this.community.edit(actorOf(r), id, d);
  }
  @Delete(":id")
  @Roles("User")
  @ApiOperation({ summary: "BLG-04 Delete own post" })
  delete(@Req() r: Request, @Param("id") id: string, @Body() _d: ConfirmDto) {
    return this.community.removePost(actorOf(r), id);
  }
  @Post(":id/comments")
  @Roles("User")
  @ApiOperation({ summary: "BLG-05 Comment on a published post" })
  comment(@Req() r: Request, @Param("id") id: string, @Body() d: CommentDto) {
    return this.community.comment(actorOf(r), id, d);
  }
  @Post(":id/like")
  @Roles("User")
  @ApiOperation({ summary: "BLG-06 Like once" })
  like(@Req() r: Request, @Param("id") id: string) {
    return this.community.like(actorOf(r), id, true);
  }
  @Delete(":id/like")
  @Roles("User")
  @ApiOperation({ summary: "BLG-06 Remove like" })
  unlike(@Req() r: Request, @Param("id") id: string) {
    return this.community.like(actorOf(r), id, false);
  }
  @Patch(":id/itinerary")
  @Roles("User")
  @ApiOperation({
    summary: "BLG-13 [Bonus] Attach or remove a public itinerary",
  })
  attach(
    @Req() r: Request,
    @Param("id") id: string,
    @Body() d: AttachItineraryDto,
  ) {
    return this.community.attach(actorOf(r), id, d);
  }
}
@ApiTags("Community")
@ApiCookieAuth()
@Controller()
export class CommunityController {
  constructor(readonly community: CommunityService) {}
  @Patch("comments/:id")
  @Roles("User")
  @ApiOperation({ summary: "BLG-07 Edit own comment" })
  comment(@Req() r: Request, @Param("id") id: string, @Body() d: CommentDto) {
    return this.community.editComment(actorOf(r), id, d);
  }
  @Delete("comments/:id")
  @Roles("User")
  @ApiOperation({ summary: "BLG-07 Delete own comment" })
  deleteComment(
    @Req() r: Request,
    @Param("id") id: string,
    @Body() _d: ConfirmDto,
  ) {
    return this.community.editComment(actorOf(r), id);
  }
  @Get("tags/:tag/posts")
  @Public()
  @ApiOperation({ summary: "BLG-08 Browse posts with a tag" })
  tag(@Param("tag") tag: string, @Query() q: PageDto) {
    return this.community.list({ page: q.page, tag });
  }
  @Get("authors/:id")
  @Public()
  @ApiOperation({ summary: "BLG-12 View public author page" })
  author(@Param("id") id: string, @Query() q: PageDto) {
    return this.community.author(id, q.page);
  }
  @Post("hotel-bookings/:id/review")
  @Roles("User")
  @ApiOperation({ summary: "HTL-23 Review a completed reservation once" })
  review(@Req() r: Request, @Param("id") id: string, @Body() d: ReviewDto) {
    return this.community.review(actorOf(r), id, d);
  }
  @Patch("reviews/:id")
  @Roles("User")
  @ApiOperation({ summary: "HTL-23 Edit own review" })
  editReview(
    @Req() r: Request,
    @Param("id") id: string,
    @Body() d: PatchReviewDto,
  ) {
    return this.community.editReview(actorOf(r), id, d);
  }
  @Delete("reviews/:id")
  @Roles("User")
  @ApiOperation({ summary: "HTL-23 Delete own review and recalculate rating" })
  deleteReview(
    @Req() r: Request,
    @Param("id") id: string,
    @Body() _d: ConfirmDto,
  ) {
    return this.community.editReview(actorOf(r), id);
  }
  @Get("hotels/:id/reviews")
  @Public()
  @ApiOperation({ summary: "HTL-24 View hotel ratings and reviews" })
  reviews(@Req() r: Request, @Param("id") id: string, @Query() q: PageDto) {
    return this.community.reviews(id, q.page, actorOf(r));
  }
  @Post("reviews/:id/reply")
  @Roles("HotelModerator")
  @ApiOperation({ summary: "HTL-26 [Bonus] Reply to assigned hotel review" })
  reply(@Req() r: Request, @Param("id") id: string, @Body() d: ReplyDto) {
    return this.community.reply(actorOf(r), id, d);
  }
  @Post("reports")
  @Roles("User")
  @ApiOperation({ summary: "GEN-09 Report supported content once" })
  report(@Req() r: Request, @Body() d: ReportDto) {
    return this.community.report(actorOf(r), d);
  }
}
