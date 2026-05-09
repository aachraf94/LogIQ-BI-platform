"""
Database router — directs analytics app queries to the warehouse DB,
everything else to the platform DB.
"""


class LogiqDBRouter:
    WAREHOUSE_APPS = {"analytics"}

    def db_for_read(self, model, **hints):
        if model._meta.app_label in self.WAREHOUSE_APPS:
            return "warehouse"
        return "default"

    def db_for_write(self, model, **hints):
        if model._meta.app_label in self.WAREHOUSE_APPS:
            return "warehouse"
        return "default"

    def allow_relation(self, obj1, obj2, **hints):
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if app_label in self.WAREHOUSE_APPS:
            return db == "warehouse"
        return db == "default"
