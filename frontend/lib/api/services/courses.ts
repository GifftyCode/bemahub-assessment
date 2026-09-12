/**
 * Courses service.
 *
 * GET /courses - public, no authentication required.
 */
import api from "@/lib/api/client";
import type { CourseListResponse } from "@/lib/types/api";

export async function getCourses(): Promise<CourseListResponse> {
  const { data } = await api.get<CourseListResponse>("/courses");
  return data;
}
