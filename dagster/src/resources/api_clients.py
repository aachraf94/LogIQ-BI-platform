"""
API client resources — one per source system.
All clients handle auth, pagination, and retry with exponential backoff.
"""

import requests
from dagster import ConfigurableResource
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type


_retry = retry(
    retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)),
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    reraise=True,
)


class YalidineAPIClient(ConfigurableResource):
    """Client for the Yalidine Express tracking API (5 endpoints)."""

    base_url: str
    api_id: str
    api_token: str

    def _headers(self) -> dict:
        return {"x-api-id": self.api_id, "x-api-token": self.api_token}

    @_retry
    def _get(self, path: str, params: dict = None) -> object:
        resp = requests.get(
            f"{self.base_url.rstrip('/')}/{path.lstrip('/')}",
            headers=self._headers(),
            params=params,
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json()

    def get_wilayas(self) -> list:
        return self._get("/yalidine/wilayas")

    def get_communes(self) -> list:
        """API returns dict keyed by index string — iterate values."""
        data = self._get("/yalidine/communes")
        return list(data.values())

    def get_centers(self) -> list:
        """API returns dict keyed by hub_id — iterate values."""
        data = self._get("/yalidine/centers")
        return list(data.values())

    def get_pricing(self) -> list:
        """
        Flattens the nested pricing dict into rows with service_type injected.
        Skips the static 'poids' block (not stored in DB).
        """
        data = self._get("/yalidine/pricing")
        rows = []
        for service_type, entries in data.items():
            if service_type == "poids" or not isinstance(entries, list):
                continue
            for e in entries:
                rows.append({
                    "service_type": service_type,
                    "wilaya_id": int(e["wilaya_id"]),
                    "tarif": str(e.get("tarif", "0")),
                    "tarif_stopdesk": str(e.get("tarif_stopdesk", "0")),
                })
        return rows

    def get_histories_page(
        self,
        date_from: str,
        date_to: str,
        page: int = 1,
        limit: int = 1000,
        order: str = "asc",
    ) -> dict:
        """One page of parcel history. date_from/date_to: 'YYYY-MM-DD'."""
        return self._get("/yalidine/histories", params={
            "date_from": date_from,
            "date_to": date_to,
            "page": page,
            "limit": limit,
            "order": order,
        })


class HRForceAPIClient(ConfigurableResource):
    """Client for the HRFORCE HR platform API (4 endpoints)."""

    base_url: str
    token: str

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}

    @_retry
    def _get(self, path: str, params: dict = None) -> object:
        resp = requests.get(
            f"{self.base_url.rstrip('/')}/{path.lstrip('/')}",
            headers=self._headers(),
            params=params,
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json()

    def get_companies(self) -> list:
        return self._get("/hrforce/companies")

    def get_all_agencies(self, page_size: int = 200) -> list:
        """Paginated. Response: {items, meta: {totalPages, currentPage, ...}}."""
        all_items = []
        page = 1
        while True:
            resp = self._get("/hrforce/agencies", params={"page": page, "limit": page_size})
            items = resp.get("items", [])
            all_items.extend(items)
            meta = resp.get("meta", {})
            if page >= meta.get("totalPages", 1):
                break
            page += 1
        return all_items

    def get_all_users(self, page_size: int = 500) -> list:
        """Paginated. Response: list of users (stops when page returns fewer than limit)."""
        all_items = []
        page = 1
        while True:
            resp = self._get("/hrforce/users", params={"page": page, "limit": page_size})
            items = resp if isinstance(resp, list) else resp.get("items", [])
            if not items:
                break
            all_items.extend(items)
            if len(items) < page_size:
                break
            page += 1
        return all_items

    def get_occupations(self) -> list:
        return self._get("/hrforce/occupations")


class CashBoxAPIClient(ConfigurableResource):
    """Client for the CashBox expense management API (5 endpoints)."""

    base_url: str
    token: str

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}

    @_retry
    def _get(self, path: str, params: dict = None) -> object:
        resp = requests.get(
            f"{self.base_url.rstrip('/')}/{path.lstrip('/')}",
            headers=self._headers(),
            params=params,
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json()

    def _paginate(self, path: str, extra_params: dict = None, page_size: int = 500) -> list:
        """Paginator for cashbox endpoints: {results, pagination: {next_page}}."""
        all_results = []
        page = 1
        params = dict(extra_params or {})
        params["limit"] = page_size
        while True:
            params["page"] = page
            resp = self._get(path, params=params)
            results = resp.get("results", [])
            all_results.extend(results)
            if resp.get("pagination", {}).get("next_page") is None:
                break
            page += 1
        return all_results

    def get_natures(self) -> list:
        """Each nature contains its rubriques inline as a list."""
        return self._get("/cashbox/natures")

    def get_all_depenses(
        self,
        date_from: str = None,
        date_to: str = None,
        page_size: int = 1000,
    ) -> list:
        params = {}
        if date_from:
            params["date_from"] = date_from
        if date_to:
            params["date_to"] = date_to
        return self._paginate("/cashbox/depenses", extra_params=params, page_size=page_size)

    def get_all_paiements_livreurs(self) -> list:
        return self._paginate("/cashbox/paiements-livreurs")

    def get_all_remboursements(self) -> list:
        return self._paginate("/cashbox/remboursements")

    def get_all_transferts(self) -> list:
        return self._paginate("/cashbox/transferts")


class PaieAPIClient(ConfigurableResource):
    """Client for the PC Paie payroll API (1 endpoint)."""

    base_url: str
    token: str

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}

    @_retry
    def _get(self, path: str, params: dict = None) -> dict:
        resp = requests.get(
            f"{self.base_url.rstrip('/')}/{path.lstrip('/')}",
            headers=self._headers(),
            params=params,
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json()

    def get_all_bulletins(self, page_size: int = 500) -> list:
        all_results = []
        page = 1
        while True:
            resp = self._get("/paie/bulletins", params={"page": page, "limit": page_size})
            results = resp.get("results", [])
            all_results.extend(results)
            if resp.get("pagination", {}).get("next_page") is None:
                break
            page += 1
        return all_results


class TransportAPIClient(ConfigurableResource):
    """Client for the Dedicated Transport API (1 endpoint, stops embedded in each request)."""

    base_url: str
    token: str

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}

    @_retry
    def _get(self, path: str, params: dict = None) -> dict:
        resp = requests.get(
            f"{self.base_url.rstrip('/')}/{path.lstrip('/')}",
            headers=self._headers(),
            params=params,
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json()

    def get_all_requests(self, page_size: int = 100) -> list:
        all_results = []
        page = 1
        while True:
            resp = self._get("/transport/requests", params={"page": page, "limit": page_size})
            results = resp.get("results", [])
            all_results.extend(results)
            if resp.get("pagination", {}).get("next_page") is None:
                break
            page += 1
        return all_results
