var mongoose = require('mongoose'),
    Entity = require('../models/entity'),
    Person = require('../models/entities/person'),
    Place = require('../models/entities/place'),
    Organization = require('../models/entities/organization'),
    Event = require('../models/entities/event'),
    Quote = require('../models/entities/quote');

module.exports = new function() {

  /**
   * POST - Create a new entity
   */
  this.create = function(req, res) {
    if (!req.body.type)
      return res.status(400).json({ error: "Entity type required." });
        
    var entity = req.body;

    entity = Entity.getEntityByType(req.body.type, entity);
    if (entity === null)
      res.status(400).json({ error: "Invalid entity type specified." });
    
    entity.save(function(err, entity) {
      if (err) return res.status(500).json({ error: "Unable to create entity." });
      res.status(201).json(entity);
    });
  };

  /**
   * GET - Fetch an entity by ID
   */
  this.retrieve = function(req, res) {
    if (req.params.id === null)
      return res.status(400).json({ error: "Entity ID required" });

    // @TODO Check ID is valid ObjectId format (for now just throws 500 error)
    
    mongoose.connection.db
    .collection('entities')
    .findOne({_id: mongoose.Types.ObjectId(req.params.id)}, function(err, entity) {
      if (err) return res.status(400).json({ error: "Unable to fetch entity." });
      
      if (!entity)
        return res.status(404).json({ error: "Entity ID not valid" });

      // Use the appropriate model based on the entity type
      entity = Entity.getEntityByType(entity._type, entity);
      if (entity === null)
        return res.status(500).json({ error: "Unable to return entity - entity is of unknown type" });

      if (/application\/ld+json;/.test(req.get('accept'))) {
        // Return JSON-LD if supported
        res.json(entity.toJSONLD);
      } else {
        // Otherwise return plain JSON object
        res.json(entity);
      }
    });

  };

  /**
   * PUT - Update an entity
   */
  this.update = function(req, res) {
    if (req.params.id === null)
      return res.status(400).json({ error: "Entity ID required" });

    // @TODO Check ID is valid ObjectId format (for now just throws 500 error)
    
    mongoose.connection.db
    .collection('entities')
    .findOne({_id: mongoose.Types.ObjectId(req.params.id)}, function(err, entityInDatabase) {
      if (err) return res.status(400).json("Unable to fetch entity.");
      
      if (!entityInDatabase)
        return res.status(404).json({ error: "Entity ID not valid" });

      var entity = req.body;
      
      entity = Entity.getEntityByType(entityInDatabase._type, entity, true);
      if (entity === null)
        res.status(500).json({ error: "Entity is of invalid type." });

      // Ignore changes to fields we want to regard as immutable, and persist 
      // the values (e.g. carry over existing values for keys like createdOn)
      Entity.immutable.forEach(function(key) {
        entity[key] = entityInDatabase[key];
      });

      // Save changes to entity
      entity.save(function(err, entity) {
        if (err) return res.status(500).json({ error: "Unable to update entity." });
        res.json(entity);
      });
    });
  };

  /**
   * DELETE - Remove an entity
   */
  this.delete = function(req, res) {
    if (req.params.id === null)
      return res.status(400).json({ error: "Entity ID required" });

    // @TODO Check ID is valid ObjectId format (for now just throws 500 error)
    
    mongoose.connection.db
    .collection('entities')
    .remove({_id: mongoose.Types.ObjectId(req.params.id)}, function(err, entity) {
      if (err) return res.status(500).json({ error: "Unable to delete entity." });

      if (!entity)
        return res.status(404).json({ error: "Entity has already been deleted" });
      return res.status(204).json();
    });
  };

  /**
   * Search (a GET request) returns entities matching the specified query
   */
  this.search = function(req, res) {
    var query = {};

    if (req.query.type)
      query._type = req.query.type;

    if (req.query.name)
      query.name = req.query.name;

    if (req.query.sameAs)
      query.sameAs = req.query.sameAs;

    mongoose.connection.db
    .collection('entities')
    .find(query)
    .toArray(function(err, results) {
      if (err) return res.status(500).json({ error: "Unable to search entities." });
      
      // For each result, format it using the appropriate Entity model
      var entities = [];
      results.forEach(function(entity) {
        entities.push( Entity.getEntityByType(entity._type, entity, true) );
      });
      
      return res.status(200).json(entities);
    });
  };

  return this;
};
