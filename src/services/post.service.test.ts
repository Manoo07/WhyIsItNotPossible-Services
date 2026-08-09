import { describe, it, expect, vi, beforeEach } from "vitest";
import * as postDao from "../dao/post.dao.js";
import * as categoryDao from "../dao/category.dao.js";
import * as tagDao from "../dao/tag.dao.js";
import * as likeDao from "../dao/like.dao.js";
import * as bookmarkDao from "../dao/bookmark.dao.js";
import * as commentDao from "../dao/comment.dao.js";
import * as userDao from "../dao/user.dao.js";
import { enqueuePostPublished } from "../queues/notification.queue.js";
import * as postService from "./post.service.js";

// Mocked DAOs — pins down the one rule the notification system depends on:
// a fanout job is enqueued on the draft->published transition and nowhere
// else (FRS §7). See docs/notification-system-architecture-review.md #9.
vi.mock("../dao/post.dao.js");
vi.mock("../dao/category.dao.js");
vi.mock("../dao/tag.dao.js");
vi.mock("../dao/like.dao.js");
vi.mock("../dao/bookmark.dao.js");
vi.mock("../dao/comment.dao.js");
vi.mock("../dao/user.dao.js");
vi.mock("../queues/notification.queue.js");

const currentUser = { id: 1, role: "author" };
const PUBLISHABLE_CONTENT = `<p>${"word ".repeat(30)}</p>`;

function fakePost(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: "Test post",
    subtitle: null,
    slug: "test-post",
    content: PUBLISHABLE_CONTENT,
    excerpt: null,
    coverImageUrl: null,
    status: "draft",
    featured: false,
    authorId: 1,
    categoryId: null,
    viewCount: 0,
    readingTime: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    ...overrides,
  };
}

describe("post.service publish-notification trigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // enrichPost()'s DAO fan-out — same stub set for every test, since none
    // of these tests are about what enrichPost returns.
    vi.mocked(userDao.findById).mockResolvedValue({ id: 1, passwordHash: "x" } as any);
    vi.mocked(categoryDao.findById).mockResolvedValue(null);
    vi.mocked(likeDao.countByPost).mockResolvedValue(0);
    vi.mocked(commentDao.countByPost).mockResolvedValue(0);
    vi.mocked(likeDao.find).mockResolvedValue(null as any);
    vi.mocked(bookmarkDao.find).mockResolvedValue(null as any);

    // syncPostTags()'s DAO calls, and the existing-tags lookup update() uses
    // to re-validate assertPublishable's "1-5 tags" rule on every edit to an
    // already-published post — a real published post always has >=1 tag,
    // since that's required to have gotten published in the first place.
    vi.mocked(tagDao.findPostTagsByPost).mockResolvedValue([{ tag: { name: "a" } }] as any);
    vi.mocked(tagDao.findBySlug).mockResolvedValue(null);
    vi.mocked(tagDao.create).mockResolvedValue({ id: 1, name: "a", slug: "a" } as any);
    vi.mocked(tagDao.upsertPostTag).mockResolvedValue({} as any);
    vi.mocked(tagDao.deletePostTagsByPost).mockResolvedValue({} as any);
    vi.mocked(postDao.count).mockResolvedValue(0);
  });

  it("create(): enqueues a fanout job when a post is created already published", async () => {
    vi.mocked(postDao.findBySlug).mockResolvedValue(null);
    vi.mocked(postDao.create).mockResolvedValue(fakePost({ status: "published" }) as any);

    await postService.create(currentUser, {
      title: "Hello world",
      content: PUBLISHABLE_CONTENT,
      status: "published",
      tags: ["a"],
    } as any);

    expect(enqueuePostPublished).toHaveBeenCalledTimes(1);
    expect(enqueuePostPublished).toHaveBeenCalledWith(1);
  });

  it("create(): does not enqueue a fanout job for a draft", async () => {
    vi.mocked(postDao.findBySlug).mockResolvedValue(null);
    vi.mocked(postDao.create).mockResolvedValue(fakePost({ status: "draft" }) as any);

    await postService.create(currentUser, { title: "Hello world", content: "draft content", status: "draft" } as any);

    expect(enqueuePostPublished).not.toHaveBeenCalled();
  });

  it("create(): rejects a new post once the author has hit the daily post limit", async () => {
    vi.mocked(postDao.count).mockResolvedValue(10);

    await expect(
      postService.create(currentUser, { title: "Hello world", content: "draft content", status: "draft" } as any),
    ).rejects.toMatchObject({ statusCode: 429 });

    expect(postDao.create).not.toHaveBeenCalled();
  });

  it("create(): owners are exempt from the daily post limit", async () => {
    vi.mocked(postDao.count).mockResolvedValue(10);
    vi.mocked(postDao.findBySlug).mockResolvedValue(null);
    vi.mocked(postDao.create).mockResolvedValue(fakePost({ status: "draft" }) as any);

    await expect(
      postService.create({ id: 1, role: "owner" }, { title: "Hello world", content: "draft content", status: "draft" } as any),
    ).resolves.toBeDefined();
  });

  it("create(): rejects publishing a post with more than 10 images", async () => {
    vi.mocked(postDao.findBySlug).mockResolvedValue(null);
    const manyImages = `<p>${"word ".repeat(30)}</p>` + "<img src=\"x.jpg\" alt=\"x\">".repeat(11);

    await expect(
      postService.create(currentUser, { title: "Hello world", content: manyImages, status: "published", tags: ["a"] } as any),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(postDao.create).not.toHaveBeenCalled();
  });

  it("update(): enqueues a fanout job on the draft->published transition", async () => {
    vi.mocked(postDao.findById).mockResolvedValue(fakePost({ status: "draft" }) as any);
    vi.mocked(postDao.update).mockResolvedValue(fakePost({ status: "published" }) as any);

    await postService.update(1, currentUser, { status: "published", tags: ["a"] } as any);

    expect(enqueuePostPublished).toHaveBeenCalledTimes(1);
    expect(enqueuePostPublished).toHaveBeenCalledWith(1);
  });

  it("update(): does not enqueue a fanout job when editing an already-published post", async () => {
    vi.mocked(postDao.findById).mockResolvedValue(fakePost({ status: "published" }) as any);
    vi.mocked(postDao.update).mockResolvedValue(fakePost({ status: "published", title: "Edited" }) as any);

    await postService.update(1, currentUser, { title: "Edited" } as any);

    expect(enqueuePostPublished).not.toHaveBeenCalled();
  });

  it("update(): does not enqueue a fanout job when saving a draft as a draft", async () => {
    vi.mocked(postDao.findById).mockResolvedValue(fakePost({ status: "draft" }) as any);
    vi.mocked(postDao.update).mockResolvedValue(fakePost({ status: "draft", title: "Still a draft" }) as any);

    await postService.update(1, currentUser, { title: "Still a draft" } as any);

    expect(enqueuePostPublished).not.toHaveBeenCalled();
  });
});
