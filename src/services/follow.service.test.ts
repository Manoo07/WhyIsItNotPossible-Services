import { describe, it, expect, vi, beforeEach } from "vitest";
import * as followDao from "../dao/follow.dao.js";
import * as userDao from "../dao/user.dao.js";
import * as followService from "./follow.service.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../lib/errors.js";

// Mocked DAOs — these tests pin down follow.service.ts's idempotency and
// authorization behavior (FRS §21) without needing a real database.
// See docs/notification-system-architecture-review.md #9.
vi.mock("../dao/follow.dao.js");
vi.mock("../dao/user.dao.js");

const author = { id: 2, role: "author" } as any;
const reader = { id: 3, role: "reader" } as any;

describe("follow.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("follow", () => {
    it("rejects following yourself", async () => {
      await expect(followService.follow(1, 1)).rejects.toBeInstanceOf(BadRequestError);
      expect(followDao.upsertFollow).not.toHaveBeenCalled();
    });

    it("404s when the target isn't an author or owner", async () => {
      vi.mocked(userDao.findById).mockResolvedValue(reader);
      await expect(followService.follow(1, 3)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("404s when the target doesn't exist", async () => {
      vi.mocked(userDao.findById).mockResolvedValue(null);
      await expect(followService.follow(1, 999)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("is idempotent — following the same author twice succeeds both times without erroring", async () => {
      vi.mocked(userDao.findById).mockResolvedValue(author);
      vi.mocked(followDao.upsertFollow).mockResolvedValue({} as any);

      await expect(followService.follow(1, 2)).resolves.toEqual({ following: true, notificationEnabled: true });
      await expect(followService.follow(1, 2)).resolves.toEqual({ following: true, notificationEnabled: true });

      expect(followDao.upsertFollow).toHaveBeenCalledTimes(2);
    });
  });

  describe("unfollow", () => {
    it("is idempotent — unfollowing an author you don't follow succeeds rather than erroring", async () => {
      vi.mocked(followDao.removeFollow).mockResolvedValue(false);
      await expect(followService.unfollow(1, 2)).resolves.toEqual({ following: false });
    });

    it("succeeds when a follow relationship did exist", async () => {
      vi.mocked(followDao.removeFollow).mockResolvedValue(true);
      await expect(followService.unfollow(1, 2)).resolves.toEqual({ following: false });
    });
  });

  describe("updateNotificationPreference", () => {
    it("rejects updating the preference for an author you don't follow", async () => {
      vi.mocked(followDao.findByUserAndAuthor).mockResolvedValue(null);
      await expect(followService.updateNotificationPreference(1, 2, false)).rejects.toBeInstanceOf(ForbiddenError);
      expect(followDao.updateNotificationPreference).not.toHaveBeenCalled();
    });

    it("updates the preference when a follow relationship exists", async () => {
      vi.mocked(followDao.findByUserAndAuthor).mockResolvedValue({ userId: 1, authorId: 2 } as any);
      vi.mocked(followDao.updateNotificationPreference).mockResolvedValue({ notificationEnabled: false } as any);

      await expect(followService.updateNotificationPreference(1, 2, false)).resolves.toEqual({
        following: true,
        notificationEnabled: false,
      });
    });
  });
});
