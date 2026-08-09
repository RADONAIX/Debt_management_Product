"""Performance Reports routes: /reports.

Four registers behind one filter dependency, so the screen's filter bar means
the same thing on every tab.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query

from app.core.deps import DbSession, Principal, require
from app.core.rbac import PermKey
from app.modules.reports import schemas, service

router = APIRouter(prefix="/reports", tags=["reports"])

_can_view = require(PermKey.PERFORMANCE_REPORTS, "view")


def filters(
    search: str | None = Query(default=None, max_length=120),
    status: str | None = Query(default=None),
    source: str | None = Query(default=None, max_length=60),
    customerScope: str | None = Query(default=None, pattern="^(all|consumer|enterprise)$"),
    customerType: str | None = Query(default=None),
    region: str | None = Query(default=None),
    dateFrom: date | None = Query(default=None),
    dateTo: date | None = Query(default=None),
    channel: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    reason: str | None = Query(default=None),
    stage: str | None = Query(default=None),
    agency: str | None = Query(default=None),
) -> schemas.Filters:
    return schemas.Filters(
        search=search, status=status, source=source,
        customerScope=None if customerScope == "all" else customerScope,
        customerType=customerType, region=region,
        dateFrom=dateFrom, dateTo=dateTo, channel=channel, priority=priority,
        reason=reason, stage=stage, agency=agency,
    )


Filt = Depends(filters)
Sort = Query(default=None, max_length=40)
Dir = Query(default="desc", pattern="^(asc|desc)$")
# The table pages at 25; the ceiling exists so an export can pull the register
# in one request without letting a client ask for the whole book.
Limit = Query(default=25, ge=1, le=1000)
Offset = Query(default=0, ge=0)


@router.get("/options", response_model=schemas.FilterOptions)
async def options(db: DbSession, _: Principal = Depends(_can_view)) -> schemas.FilterOptions:
    return await service.filter_options(db)


@router.get("/ptps", response_model=schemas.PtpPage)
async def ptps(
    db: DbSession,
    f: schemas.Filters = Filt,
    sort: str | None = Sort,
    dir: str = Dir,
    limit: int = Limit,
    offset: int = Offset,
    _: Principal = Depends(_can_view),
) -> schemas.PtpPage:
    return await service.list_ptps(db, f, sort=sort, direction=dir, limit=limit, offset=offset)


@router.get("/disputes", response_model=schemas.DisputePage)
async def disputes(
    db: DbSession,
    f: schemas.Filters = Filt,
    sort: str | None = Sort,
    dir: str = Dir,
    limit: int = Limit,
    offset: int = Offset,
    _: Principal = Depends(_can_view),
) -> schemas.DisputePage:
    return await service.list_disputes(db, f, sort=sort, direction=dir, limit=limit, offset=offset)


@router.get("/legal-escalations", response_model=schemas.LegalPage)
async def legal(
    db: DbSession,
    f: schemas.Filters = Filt,
    sort: str | None = Sort,
    dir: str = Dir,
    limit: int = Limit,
    offset: int = Offset,
    _: Principal = Depends(_can_view),
) -> schemas.LegalPage:
    return await service.list_legal(db, f, sort=sort, direction=dir, limit=limit, offset=offset)


@router.get("/agency-escalations", response_model=schemas.AgencyPage)
async def agency(
    db: DbSession,
    f: schemas.Filters = Filt,
    sort: str | None = Sort,
    dir: str = Dir,
    limit: int = Limit,
    offset: int = Offset,
    _: Principal = Depends(_can_view),
) -> schemas.AgencyPage:
    return await service.list_agency(db, f, sort=sort, direction=dir, limit=limit, offset=offset)
