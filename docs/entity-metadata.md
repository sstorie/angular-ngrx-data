# Entity Metadata

The _ngrx-data_ library maintains a **_cache_** of entity collection data in the _ngrx store_.

You tell the _ngrx-data_ library about those collections and the entities they contain with **_entity metadata_**.

The entities within a collection belong to the same **_entity type_**.
Each _entity type_ appears as named instance of the _ngrx-data_ [**`EntityMetadata<T>`**](#entity-metadata-interface) interface.

You can specify metadata for several entities at the same time in an **`EntityMetadataMap`**.

Here is an example `EntityMetadataMap` similar to the one in the demo app
that defines metadata for two entities, `Hero` and `Villain`.

```javascript
export const appEntityMetadata: EntityMetadataMap = {
  Hero: {
    /* optional settings */
    filterFn: nameFilter,
    sortComparer: sortByName
  },
  Villain: {
    villainSelectId, // necessary if key is not `id`

    /* optional settings */
    entityName: 'Villain', // optional because same as map key
    filterFn: nameAndSayingFilter,
    entityDispatcherOptions: { optimisticAdd: true, optimisticUpdate: true }
  }
};
```

## Register metadata

You must register the metadata with the _ngrx-data_ `EntityDefinitionService`.

The easiest way to register metadata is to define a single `EntityMetadataMap` for the entire application and specify it in the one place where you initialize the _ngrx-data_ library:

```javascript
    NgrxDataModule.forRoot({
      ...
      entityMetadata: appEntityMetadata,
      ...
    })
```

If you define entities in several, different _eagerly-loaded_ Angular modules, you can add the metadata for each module with the multi-provider.

```javascript
{ provide: ENTITY_METADATA_TOKEN, multi: true, useValue: someEntityMetadata }
```

This technique won't work for a _lazy-loaded_ module.
The `ENTITY_METADATA_TOKEN` provider was already set and consumed by the time the _lazy-loaded_ module arrives.

The module should inject the `EntityDefinitionService`
instead and register metadata directly with one of the registration methods.

```javascript
@NgModule({...})
class LazyModule {
  constructor(eds: EntityDefinitionService) {
    eds.registerMetadataMap(this.lazyMetadataMap);
  }
  ...
}
```

<a name="entity-metadata-interface"></a>

## Metadata Properties

The `EntityMedata<T>` interface describes aspects of an entity type that tell the _ngrx-data_ library how to manage collections of entity data of type `T`.

Type `T` is your application's TypeScript representation of that entity; it can be an interface or a class.

### _entityName_

The `entityName` of the type is the only **required metadata property**.
It's the unique _key_ of the entity type's metadata in cache.

It _must_ be specified for individual `EntityMetadata` instances.
If you omit it in an `EntityMetadataMap`, the map _key_ becomes the `entityName` as in this example.

```javascript
const map = {
  Hero: {} // "Hero" becomes the entityName
};
```

The spelling and case (typically PascalCase) of the `entityName` is important for _ngrx-data_ conventions. It appears in the generated [_entity actions_](docs/entity-actions), in error messages, and in the persistence operations.

Importantly, the default [_entity dataservice_](docs/entity-dataservice.md) creates HTTP resource URLs from the lowercase version of this name. For example, if the `entityName` is "Hero", the default data service will POST to a URL such as `'api/hero'`.

> By default it generates the _plural_ of the entity name when preparing a _collection_ resource URL.
>
> It isn't good at pluralization.
> It would produce `'api/heros'` for the URL to fetch _all heroes_ because it blindly adds an `'s'` to the end of the lowercase entity name.
>
> Of course the proper plural of "hero" is "hero**es**", not "hero**s**".
> You'll see how to correct this problem [below](#plurals).

<a name=filterfn></a>

### _filterFn_

Many applications allow the user to filter a cached entity collection.

In the accompanying demonstration app, the user can filter _heroes_ by name and can filter _villains_ by name or the villain's _saying_.

We felt this common scenario is worth building into the _ngrx-data_ library. So every entity can have an _optional_ filter function.

Each collection's `filteredEntities` selector applies the filter function to the collection, based on the user's filtering criteria, which are held in the the stored entity collection's `filter` property.

If there is no filter function, the `filteredEntities` selector is the same as the `selectAll` selector, which returns all entities in the collection.

A filter function (see [`EntityFilterFn<T>`](../lib/src/entity-metadata/entity-filters.ts)) takes an entity collection and the user's filtering criteria (the filter _pattern_) and returns an array of the selected entities.

Here's an example that filters for entities with a `name` property whose value contains the search string.

```javascript
export function nameFilter(entities: { name: string }[], search: string) {
  return entities.filter(e => -1 < e.name.indexOf(search));
}
```

The _ngrx-data_ library includes a helper function, `PropsFilterFnFactory<T>`, that creates an entity filter function which will treat the user's input
as a case-insensitive, regular expression and apply it to one or more properties of the entity.

The demo uses this helper to create hero and villain filters. Here's how the app creates the `nameAndSayingFilter` function for villains.

```javascript
/**
 * Filter for entities whose name or saying
 * matches the case-insensitive pattern.
 */
export function nameAndSayingFilter(entities: Villain[], pattern: string) {
  return PropsFilterFnFactory < Villain > ['name', 'saying'](entities, pattern);
}
```

<a name=selectid></a>

### _selectId_

Every _entity type_ must have a _primary key_ whose value is an integer or a string.

The _ngrx-data_ library assumes that the entity has an `id` property whose value is the primary key.

Not every entity will have a primary key property named `id`. For some entities, the primary key could be the combined value of two or more properties.

In these cases, you specify a `selectId` function that, given an entity instance, returns an integer or string primary key value.

In the [entity reducer tests](../lib/src/reducers/entity-reducer.spec.ts), the `Villain` type has a string primary key property named `key`.
The `selectorId` function is this:

```javascript
selectId: (villain: Villain) => villain.key;
```

<a name=sortcomparer></a>

### _sortComparer_

The _ngrx-data_ library keeps the collection entities in a specific order.

> This is actually a feature of the underlying `@ngrx/entity` library.

The default order is the order in which the entities arrive from the server.
The entities you add are pushed to the end of the collection.

You may prefer to maintain the collection in some other order.
When you provide a `sortComparer` function, the _ngrx-lib_ keeps the collection in the order prescribed by your comparer.

In the demo app, the villains metadata has no comparer so its entities are in default order.

The hero metadata have a `sortByName` comparer that keeps the collection in alphabetical order by `name`.

```javascript
export function sortByName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name);
}
```

Run the demo app and try changing existing hero names or adding new heroes.

Your app can call the `selectKey` selector to see the collection's `ids` property, which returns an array of the collection's primary key values in sorted order.

<a name="entity-dispatcher-options"></a>

### _entityDispatcherOptions_

These options determine the default behavior of the collection's _dispatcher_ which sends actions to the reducers and effects.

A dispatcher save command will add, delete, or update
the collection _before_ sending a corresponding HTTP request (_optimistic_) or _after_ (_pessimistic_).
The caller can specify in the optional `isOptimistic` parameter.
If the caller doesn't specify, the dispatcher chooses based on default options.

The _default_ defaults are the safe ones: _optimistic_ for delete and _pessimistic_ for add and update.
You can override those choices here.

<a name=additional-collection-state></a>

### _additionalCollectionState_

Each _ngrx-data_ entity collection in the the store has
[predefined properties](entity-collection.md).

You can add your own collection properties by setting the `additionalCollectionState` property to an object with those custom collection properties.

The [entity selectors tests](../lib/src/selectors/entity-selectors.spec.ts) illustrate by adding `foo` and `bar` collection properties to test hero metadata.

```javascript
  additionalCollectionState: {
    foo: 'Foo',
    bar: 3.14
  }
```

The property values become the initial collection values for those properties when _ngrx-data_ first creates the collection in the store.

The _ngrx-data_ library generates selectors for these properties but has no way to update them. You'll have to create or extend the existing reducers to do that yourself.

<a name="plurals"></a>

## Pluralizing the entity name

The _ngrx-data_ [`DefaultDataService`](docs/entity-dataservice.md) relies on the `HttpUrlGenerator` to create conventional HTTP resource names (URLs) for each entity type.

By convention, an HTTP request targeting a single entity item contains the lowercase, singular version of the entity type name. For example, if the entity type `entityName` is "Hero", the default data service will POST to a URL such as `'api/hero'`.

By convention, an HTTP request targeting multiple entities contains the lowercase, _plural_ version of the entity type name. The URL of a GET request that retrieved all heroes should be something like `'api/heroes'`.

The `HttpUrlGenerator` can't pluralize the entity type name on its own. It delegates to an injected _pluralizing class_, called `Pluralizer`.

The `Pluralizer` class has a _pluralize()_ method that takes the singular string and returns the plural string.

The default `Pluralizer` handles many of the common English pluralization rules such as appending an `'s'`. That's fine for the `Villain` type (which becomes "villains").
That's the wrong technique for pluralizing the `Hero` type (which becomes "heros").

Fortunately, the default `Pluralizer` also injects a map of singular to plural strings (with the `PLURAL_NAMES_TOKEN`).

Its `pluralize()` method looks for the singular entity name in that map and uses the corresponding plural value if found. Otherwise, it returns the entity name plus `'s'`.

If this scheme works for you, create a map of _singular-to-plural_ entity names for the exceptional cases, as the demo app does:

```javascript
export const pluralNames = {
  // Case matters. Match the case of the entity name.
  Hero: 'Heroes'
};
```

Then specify this map while configuring the _ngrx-data_ library.

```javascript
    NgrxDataModule.forRoot({
      ...
      pluralNames: pluralNames
    })
```

If you define your _entity model_ in separate Angular modules, you can incrementally add a plural names map with the multi-provider.

```javascript
{ provide: PLURAL_NAMES_TOKEN, multi: true, useValue: morePluralNames }
```

If this scheme isn't working for you, replace the `Pluralizer` class with your own invention.

```javascript
{ provide: Pluralizer, useClass: MyPluralizer }
```
