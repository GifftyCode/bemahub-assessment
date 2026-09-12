"use client";

import { useQuery } from "@tanstack/react-query";
import { StatusMessage } from "@/components/StatusMessage";
import { formatMoney, formatNullableNumber } from "@/lib/format";
import { getCourses } from "@/lib/api/services/courses";
import type { Course } from "@/lib/types/api";

/**
 * Task 1 - Course list.
 *
 * previewExpiresInSeconds: the API tells us how long this snapshot is good
 * for. Rather than let the list silently go stale, we use it to drive React
 * Query's refetchInterval - once the server-declared TTL elapses, we
 * automatically refetch. This is read from the response itself (not
 * hardcoded), so if the server changes the TTL, the frontend follows it.
 */
export default function CoursesPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["courses"],
    queryFn: getCourses,
    refetchInterval: (query) => {
      const seconds = query.state.data?.previewExpiresInSeconds;
      return seconds ? seconds * 1000 : false;
    },
  });

  if (isLoading) {
    return <StatusMessage state="loading" />;
  }

  if (isError) {
    return (
      <StatusMessage
        state="error"
        message={
          error instanceof Error
            ? `Could not load courses: ${error.message}`
            : "Could not load courses. Please try again."
        }
      />
    );
  }

  const courses: Course[] = data?.courses ?? [];

  if (courses.length === 0) {
    return <StatusMessage state="empty" message="No courses are published yet." />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Courses</h1>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 pr-4">Title</th>
            <th className="py-2 pr-4">Instructor</th>
            <th className="py-2 pr-4">Price</th>
            <th className="py-2 pr-4">Enrolments</th>
            <th className="py-2 pr-4">Rating</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => (
            <tr key={course.id} className="border-b border-slate-100">
              <td className="py-2 pr-4 text-slate-900">{course.title}</td>
              <td className="py-2 pr-4 text-slate-600">{course.instructorName}</td>
              <td className="py-2 pr-4 text-slate-600">
                {formatMoney(course.priceMinor, course.currency)}
              </td>
              <td className="py-2 pr-4 text-slate-600">
                {formatNullableNumber(course.enrolmentCount)}
              </td>
              <td className="py-2 pr-4 text-slate-600">
                {formatNullableNumber(course.averageRating)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
