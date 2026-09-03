# Real Estate Listings

This context describes property listings collected from external real-estate providers and reported through analytics.

## Language

**Property Listing**:
A distinct listing identified by its provider-specific `providerId`, regardless of how many times it is captured.
_Avoid_: Property record, posting

**New Property**:
A Property Listing counted on the calendar date when it was first observed, determined by its earliest `createdAt` value.
_Avoid_: Latest property, property record created that day
