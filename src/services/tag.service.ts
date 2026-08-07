import * as tagDao from "../dao/tag.dao.js";

export function list() {
  return tagDao.findMany();
}
