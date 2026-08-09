"""Customer 360 routes: /customers."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.deps import DbSession, PageParams, Principal, require
from app.core.rbac import PermKey
from app.modules.customers import schemas, service

router = APIRouter(prefix="/customers", tags=["customers"])

_can_view = require(PermKey.CUSTOMER_360, "view")
_can_edit = require(PermKey.CUSTOMER_360, "edit")


@router.get("", response_model=list[schemas.CustomerRow])
async def list_customers(
    db: DbSession,
    page: PageParams,
    search: str | None = Query(default=None, max_length=120),
    customerType: str | None = Query(default=None, max_length=20),
    _: Principal = Depends(_can_view),
) -> list[schemas.CustomerRow]:
    return await service.list_all(
        db, search=search, limit=page.limit, offset=page.offset, customer_type=customerType
    )


@router.get("/{code}", response_model=schemas.CustomerProfile)
async def get_customer(
    code: str, db: DbSession, _: Principal = Depends(_can_view)
) -> schemas.CustomerProfile:
    return await service.profile_with_line(db, code)


@router.get("/{code}/360", response_model=schemas.Customer360)
async def get_customer_360(
    code: str, db: DbSession, _: Principal = Depends(_can_view)
) -> schemas.Customer360:
    return await service.build_360(db, code)


@router.get("/{code}/borrower", response_model=schemas.BorrowerFile)
async def get_borrower_file(
    code: str, db: DbSession, _: Principal = Depends(_can_view)
) -> schemas.BorrowerFile:
    return await service.borrower_file(db, code)


@router.get("/{code}/signals", response_model=schemas.SubscriberSignals | None)
async def get_subscriber_signals(
    code: str, db: DbSession, _: Principal = Depends(_can_view)
) -> schemas.SubscriberSignals | None:
    return await service.subscriber_signals(db, code)


@router.patch("/{code}/profile", response_model=schemas.CustomerProfile)
async def update_customer_profile(
    code: str,
    payload: schemas.CustomerProfileUpdate,
    db: DbSession,
    _: Principal = Depends(_can_edit),
) -> schemas.CustomerProfile:
    return service.to_profile(await service.update_profile(db, code, payload))


# --- Enterprise hierarchy ---------------------------------------------------
companies_router = APIRouter(prefix="/companies", tags=["customers"])


@companies_router.get("", response_model=list[schemas.CompanyRow])
async def list_companies(
    db: DbSession, _: Principal = Depends(_can_view)
) -> list[schemas.CompanyRow]:
    return await service.list_companies(db)


@companies_router.get("/{code}/360", response_model=schemas.Customer360)
async def get_company_360(
    code: str, db: DbSession, _: Principal = Depends(_can_view)
) -> schemas.Customer360:
    return await service.build_company_360(db, code)


@companies_router.get("/{code}/borrower", response_model=schemas.BorrowerFile)
async def get_company_borrower(
    code: str, db: DbSession, _: Principal = Depends(_can_view)
) -> schemas.BorrowerFile:
    return await service.company_borrower_file(db, code)


@companies_router.get("/{code}", response_model=schemas.CompanyDetail)
async def get_company(
    code: str, db: DbSession, _: Principal = Depends(_can_view)
) -> schemas.CompanyDetail:
    return await service.company_detail(db, code)
