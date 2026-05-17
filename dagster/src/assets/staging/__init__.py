from .yalidine import (
    stg_yalidine_wilayas,
    stg_yalidine_communes,
    stg_yalidine_centers,
    stg_yalidine_pricing,
    stg_yalidine_parcel_history,
)
from .hrforce import (
    stg_hrforce_companies,
    stg_hrforce_agencies,
    stg_hrforce_occupations,
    stg_hrforce_users,
)
from .cashbox import (
    stg_cashbox_natures,
    stg_cashbox_rubriques,
    stg_cashbox_depenses,
    stg_cashbox_paiements_livreurs,
    stg_cashbox_remboursements,
    stg_cashbox_transferts,
)
from .paie import stg_paie_bulletins
from .transport import stg_transport_requests, stg_transport_stops

staging_assets = [
    stg_yalidine_wilayas,
    stg_yalidine_communes,
    stg_yalidine_centers,
    stg_yalidine_pricing,
    stg_yalidine_parcel_history,
    stg_hrforce_companies,
    stg_hrforce_agencies,
    stg_hrforce_occupations,
    stg_hrforce_users,
    stg_cashbox_natures,
    stg_cashbox_rubriques,
    stg_cashbox_depenses,
    stg_cashbox_paiements_livreurs,
    stg_cashbox_remboursements,
    stg_cashbox_transferts,
    stg_paie_bulletins,
    stg_transport_requests,
    stg_transport_stops,
]
