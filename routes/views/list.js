var keystone = require('../../'),
	_ = require('underscore'),
	moment = require('moment'),
	querystring = require('querystring'),
	utils = require('../../lib/utils');

exports = module.exports = function(req, res) {
	
	var viewLocals = {
		validationErrors: {},
		showCreateForm: _.has(req.query, 'new')
	};
	
	var sort = { by: req.query.sort || req.list.defaultSort },
		filters = (req.query.q) ? req.list.processFilters(req.query.q) : {},
		queryFilters = req.list.getSearchFilters(req.query.search, filters),
		columns = (req.query.cols) ? req.list.expandColumns(req.query.cols) : req.list.defaultColumns;
	
	if (sort.by) {
		
		sort.inv = sort.by.charAt(0) == '-';
		sort.path = (sort.inv) ? sort.by.substr(1) : sort.by;
		sort.field = req.list.fields[sort.path];
		
		var clearSort = function() {
			delete req.query.sort;
			var qs = querystring.stringify(req.query);
			return res.redirect(req.path + ((qs) ? '?' + qs : ''));
		}
		
		if (req.query.sort == req.list.defaultSort) {
			return clearSort();
		} if (sort.field) {
			sort.label = sort.field.label;
		} else if (req.list.get('sortable') && sort.by == 'sortOrder' || sort.by == '-sortOrder') {
			sort.label = 'display order';
		} else if (req.query.sort) {
			return clearSort();
		}
		
	}
	
	var renderView = function() {
		
		var query = req.list.paginate({ filters: queryFilters, page: req.params.page }).sort(sort.by);
		
		req.list.selectColumns(query, columns);
		
		var link_to = function(params) {
			var p = params.page || '';
			delete params.page;
			var queryParams = _.clone(req.query);
			for (var i in params) {
				if (params[i] == undefined) {
					delete params[i];
					delete queryParams[i];
				}
			}
			params = querystring.stringify(_.defaults(params, queryParams));
			return '/keystone/' + req.list.path + (p ? '/' + p : '') + (params ? '?' + params : '');
		}
		
		query.exec(function(err, items) {
			
			if (err) {
				console.log(err);
				return res.status(500).send("Error querying items:<br><br>" + JSON.stringify(err));
			}
			
			// if there were results but not on this page, reset the page
			if (req.params.page && items.total && !items.results.length) {
				return res.redirect('/keystone/' + req.list.path + req._parsedUrl.search);
			}
			
			// go straight to the result if there was a search, and only one result
			if (req.query.search && items.total == 1 && items.results.length == 1) {
				return res.redirect('/keystone/' + req.list.path + '/' + items.results[0].id);
			}
			
			keystone.render(req, res, 'list', _.extend(viewLocals, {
				section: keystone.nav.by.list[req.list.key] || {},
				title: 'Keystone: ' + req.list.plural,
				link_to: link_to,
				list: req.list,
				sort: sort,
				filters: filters,
				search: req.query.search,
				columns: columns,
				colPaths: _.pluck(columns, 'path'),
				items: items,
				submitted: req.body || {},
				query: req.query
			}));
			
		});
		
	}
	
	if (!req.list.get('nodelete') && req.query['delete']) {
		req.list.model.findById(req.query['delete']).remove(function(err, count) {
			if (count) {
				req.flash('success', req.list.singular + ' deleted successfully.');
			}
			res.redirect('/keystone/' + req.list.path);
		});
		
		return;
	}
	
	if (!req.list.get('nocreate') && req.method == 'POST' && req.body.action == 'create') {
		
		var item = new req.list.model(),
			updateHandler = item.getUpdateHandler(req);
		
		viewLocals.showCreateForm = true; // always show the create form after a create. success will redirect.
		
		if (req.list.nameIsInitial) {
			if (req.list.nameField.validateInput(req.body))
				req.list.nameField.updateItem(item, req.body);
			else
				updateHandler.addValidationError(req.list.nameField.path, 'Name is required.');
		}
		
		updateHandler.process(req.body, { flashErrors: true, fields: req.list.initialFields }, function(err) {
			if (err) {
				return renderView();
			}
			req.flash('success', 'New ' + req.list.singular + ' ' + req.list.getDocumentName(item) + ' created.');
			return res.redirect('/keystone/' + req.list.path + '/' + item.id);
		});
		
		return;
		
	}
	
	renderView();
	
}