from .dim_tables import (
    dim_company,
    dim_wilaya,
    dim_commune,
    dim_occupation,
    dim_agence,
    dim_employee,
    dim_freelance_driver,
)
from .fact_tables import (
    fact_livraisons,
    fact_depenses,
    fact_remboursements,
    fact_paiements_livreurs,
    fact_bulletins_salaire,
    fact_transport,
    fact_transferts_caisse,
)
from .aggregates import agg_assets

warehouse_assets = [
    dim_company,
    dim_wilaya,
    dim_commune,
    dim_occupation,
    dim_agence,
    dim_employee,
    dim_freelance_driver,
    fact_livraisons,
    fact_depenses,
    fact_remboursements,
    fact_paiements_livreurs,
    fact_bulletins_salaire,
    fact_transport,
    fact_transferts_caisse,
    *agg_assets,
]
