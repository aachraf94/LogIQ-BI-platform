"""
REST API extraction assets.

Will pull data from external REST APIs:
- Yalidine public tracking API → parcel status updates and delivery confirmations
- Fuel price API (official Algerian government endpoint) → daily fuel prices by region
- Google Maps / OSRM → route optimization and real distance/duration data

TODO:
- Implement rate limiting and exponential backoff
- Store API responses in a raw landing zone table before transformation
- Add API key rotation support via Dagster resources
"""
