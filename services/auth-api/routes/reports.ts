import { randomUUID } from 'node:crypto';

import { requirePermission } from '../authz';
import { json, parseBody, sendError } from '../http';
import { readSessionToken, resolveSession } from '../session';
import { appendAuditEvent, toReport, toSessionUser } from '../store';
import type { RouteHandlerContext } from './types';

function isValidReportStatus(value: string) {
  return value === 'open' || value === 'in_review' || value === 'resolved' || value === 'dismissed';
}

function isValidReportReason(value: string) {
  return value === 'spam' || value === 'abuse' || value === 'harassment' || value === 'other';
}

export async function handleReportRoutes(context: RouteHandlerContext): Promise<boolean> {
  const { corsOrigin, request, requestId, requestUrl, response, store } = context;
  const viewer = await resolveSession(store, readSessionToken(request));
  const viewerSession = viewer ? toSessionUser(viewer) : null;

  if (request.method === 'POST' && requestUrl.pathname === '/reports') {
    if (!requirePermission(response, { corsOrigin, permission: 'report.create:self', requestId, user: viewerSession })) {
      return true;
    }

    const body = await parseBody(request);
    const targetType = String(body.targetType ?? '').trim();
    const targetId = String(body.targetId ?? '').trim();
    const reason = String(body.reason ?? '').trim();
    const description = String(body.description ?? '').trim();

    if ((targetType !== 'user' && targetType !== 'post') || !targetId || !isValidReportReason(reason)) {
      sendError(response, {
        code: 'INVALID_REPORT',
        corsOrigin,
        message: 'A valid report target and reason are required.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    const result = await store.mutate((document) => {
      const targetExists =
        targetType === 'user'
          ? document.users.some((user) => user.id === targetId)
          : document.posts.some((post) => post.id === targetId);

      if (!targetExists) {
        return { missing: true as const };
      }

      const now = new Date().toISOString();
      const normalizedTargetType = targetType as 'user' | 'post';
      const normalizedReason = reason as 'spam' | 'abuse' | 'harassment' | 'other';
      const report = {
        id: randomUUID(),
        targetType: normalizedTargetType,
        targetId,
        reporterId: viewer!.id,
        reason: normalizedReason,
        description,
        status: 'open' as const,
        createdAt: now,
        updatedAt: now,
        resolutionNote: null,
      };

      document.reports.push(report);
      return { report };
    });

    if ('missing' in result) {
      sendError(response, {
        code: 'REPORT_TARGET_NOT_FOUND',
        corsOrigin,
        message: 'The report target does not exist.',
        requestId,
        statusCode: 404,
      });
      return true;
    }

    const document = await store.read();
    json(response, 201, { report: toReport(document, result.report, viewerSession) }, corsOrigin);
    return true;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/admin/reports') {
    if (!requirePermission(response, { corsOrigin, permission: 'report.read:any', requestId, user: viewerSession })) {
      return true;
    }

    const document = await store.read();
    const reports = document.reports
      .map((report) => toReport(document, report, viewerSession))
      .filter((report): report is NonNullable<typeof report> => Boolean(report))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    json(response, 200, { reports }, corsOrigin);
    return true;
  }

  if (request.method === 'PATCH' && requestUrl.pathname.startsWith('/admin/reports/')) {
    if (!requirePermission(response, { corsOrigin, permission: 'report.manage:any', requestId, user: viewerSession })) {
      return true;
    }

    const reportId = requestUrl.pathname.split('/').filter(Boolean)[2];
    const body = await parseBody(request);
    const status = String(body.status ?? '').trim();
    const resolutionNote =
      body.resolutionNote === null || body.resolutionNote === undefined
        ? null
        : String(body.resolutionNote).trim();

    if (!isValidReportStatus(status)) {
      sendError(response, {
        code: 'INVALID_REPORT_STATUS',
        corsOrigin,
        message: 'A valid report status is required.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    const result = await store.mutate((document) => {
      const report = document.reports.find((entry) => entry.id === reportId);

      if (!report) {
        return { missing: true as const };
      }

      report.status = status;
      report.resolutionNote = resolutionNote;
      report.updatedAt = new Date().toISOString();
      appendAuditEvent(document, {
        action: 'report.updated',
        actorUserId: viewer!.id,
        metadata: {
          status,
        },
        targetId: report.id,
        targetType: 'report',
      });

      return { report };
    });

    if ('missing' in result) {
      sendError(response, {
        code: 'REPORT_NOT_FOUND',
        corsOrigin,
        message: 'Report not found.',
        requestId,
        statusCode: 404,
      });
      return true;
    }

    const document = await store.read();
    json(response, 200, { report: toReport(document, result.report, viewerSession) }, corsOrigin);
    return true;
  }

  return false;
}
