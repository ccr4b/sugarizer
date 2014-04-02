
// Listview view
enyo.kind({
	name: "Sugar.Journal",
	published: { journal: null },
	components: [
		{name: "content", kind: "Scroller", classes: "journal-content", onresize: "draw", components: [
			{name: "empty", classes: "journal-empty", showing: true},
			{name: "message", classes: "journal-message", showing: true},
			{name: "nofilter", kind: "Sugar.IconButton", icon: {directory: "icons", icon: "dialog-cancel.svg"}, classes: "listview-button", ontap: "nofilter", ontap: "nofilter", onclick: "nofilter", showing: false},
			{name: "journalList", classes: "journal-list", kind: "Repeater", onSetupItem: "setupItem", components: [
				{name: "item", classes: "journal-list-item", components: [
					{name: "favorite", kind: "Sugar.Icon", x: 10, y: 14, size: constant.iconSizeFavorite, ontap: "switchFavorite", onclick: "switchFavorite"},			
					{name: "activity", kind: "Sugar.Icon", x: 60, y: 5, size: constant.iconSizeList, colorized: true, ontap: "runActivity", onclick: "runActivity"},
					{name: "title", classes: "journal-title"},
					{name: "time", classes: "journal-time"},
					{name: "goright", kind: "Sugar.Icon", classes: "journal-goright", size: constant.iconSizeFavorite, ontap: "runActivity", onclick: "runActivity"}
				]}
			]},
			{name: "activityPopup", kind: "Sugar.Popup", showing: false}
		]},
		{name: "footer", classes: "journal-footer toolbar", showing: false, components: [
			{name: "journalbutton", kind: "Button", classes: "toolbutton view-localjournal-button active", title:"Journal", ontap: "showLocalJournal", onclick: "showLocalJournal"},
			{name: "cloudonebutton", kind: "Button", classes: "toolbutton view-cloudone-button", title:"Private", ontap: "showPrivateCloud", onclick: "showPrivateCloud"},
			{name: "cloudallbutton", kind: "Button", classes: "toolbutton view-cloudall-button", title:"Shared", ontap: "showSharedCloud", onclick: "showSharedCloud"}
		]}
	],
  
	// Constructor: init list
	create: function() {
		this.inherited(arguments);
		this.toolbar = null;
		this.empty = (this.journal.length == 0);
		this.journalChanged();
		this.$.footer.setShowing(util.getClientType() == constant.thinClientType);		
		this.draw();
	},

	// Render
	rendered: function() {
		// Colorized list
		this.$.journalList.render();
		
		// Colorizer footer icons
		iconLib.colorize(this.$.journalbutton.hasNode(), preferences.getColor(), function() {});
		iconLib.colorize(this.$.cloudonebutton.hasNode(), preferences.getColor(), function() {});
		iconLib.colorize(this.$.cloudallbutton.hasNode(), preferences.getColor(), function() {});
	},
	
	// Get linked toolbar
	getToolbar: function() {
		if (this.toolbar == null)
			this.toolbar = new Sugar.Journal.Toolbar();
		return this.toolbar;
	},
	
	// Draw screen
	draw: function() {
		// Resize content and set Journal empty in the middle
		var canvas_center = util.getCanvasCenter();	
		var footer_size = this.$.footer.getShowing() ? 55 : 0;   // HACK: 55 is the footer height
		this.$.content.applyStyle("height", (canvas_center.dy-footer_size)+"px");
		this.$.empty.applyStyle("margin-left", (canvas_center.x-constant.sizeEmpty/4)+"px");
		var margintop = (canvas_center.y-constant.sizeEmpty/4);
		this.$.empty.applyStyle("margin-top", margintop+"px");
		this.$.message.setContent(l10n.get("JournalEmpty"));
		this.$.nofilter.setText(l10n.get("ClearSearch"));
	},
	
	// Property changed
	journalChanged: function() {
		this.$.empty.show();
		this.$.message.show();	
		this.$.nofilter.show();
		if (this.journal != null && this.journal.length > 0) {
			this.$.journalList.setCount(this.journal.length);
			this.$.empty.hide();
			this.$.message.hide();	
			this.$.nofilter.hide();
		} else {
			this.$.journalList.setCount(0);
			if (this.empty) {
				this.$.message.setContent(l10n.get("JournalEmpty"));
				this.$.nofilter.hide();
			} else
				this.$.message.setContent(l10n.get("NoMatchingEntries"));
		}
	},

	// Init setup for a line
	setupItem: function(inSender, inEvent) {
		// Set item in the template
		inEvent.item.$.activity.setIcon(preferences.getActivity(this.journal[inEvent.index].metadata.activity_id));
		inEvent.item.$.favorite.setIcon({directory: "icons", icon: "emblem-favorite.svg"});
		var keep = this.journal[inEvent.index].metadata.keep;
		inEvent.item.$.favorite.setColorized(keep !== undefined && keep == 1);		
		inEvent.item.$.title.setContent(this.journal[inEvent.index].metadata.title);	
		inEvent.item.$.time.setContent(util.timestampToElapsedString(this.journal[inEvent.index].metadata.timestamp, 2));
		inEvent.item.$.goright.setIcon({directory: "icons", icon: "go-right.svg"});
		inEvent.item.$.activity.setPopupShow(enyo.bind(this, "showActivityPopup"));
		inEvent.item.$.activity.setPopupHide(enyo.bind(this, "hideActivityPopup"));
	},
	
	// Switch favorite value for clicked line
	switchFavorite: function(inSender, inEvent) {
		var objectId = this.journal[inEvent.index].objectId;
		var keep = this.journal[inEvent.index].metadata.keep;
		if (keep === undefined)
			this.journal[inEvent.index].metadata.keep = 1;
		else
			this.journal[inEvent.index].metadata.keep = (keep + 1) % 2;
		var ds = new datastore.DatastoreObject(objectId);
		ds.setMetadata(this.journal[inEvent.index].metadata);
		ds.setDataAsText(this.journal[inEvent.index].text);
		ds.save();
		inSender.setColorized(this.journal[inEvent.index].metadata.keep == 1);
		this.render();
	},
	
	// Run activity
	runActivity: function(inSender, inEvent) {
		preferences.runActivity(
			preferences.getActivity(this.journal[inEvent.index].metadata.activity_id),
			this.journal[inEvent.index].objectId,
			this.journal[inEvent.index].metadata.title)
	},
	runCurrentActivity: function(activity) {
		preferences.runActivity(
			preferences.getActivity(activity.activityId),
			activity.instances[0].objectId,
			activity.instances[0].metadata.title);
	},
		
	// Filter entries handling
	filterEntries: function(name, favorite, typeactivity, timeperiod) {
		this.journal = datastore.find(typeactivity);
		this.journal = this.journal.filter(function(activity) {
			var range = util.getDateRange(timeperiod);
			return (favorite !== undefined ? activity.metadata.keep : true)
				&& (name.length != 0 ? activity.metadata.title.toLowerCase().indexOf(name.toLowerCase()) != -1 : true)
				&& (timeperiod !== undefined ? activity.metadata.timestamp >= range.min && activity.metadata.timestamp < range.max : true);
		});
		this.journalChanged();
	},
	
	nofilter: function() {
		toolbar.removeFilter();
		this.filterEntries("", undefined, undefined, undefined);
	},
	
	// Activity popup
	showActivityPopup: function(icon) {
		// Create popup
		var activity = icon.icon; // HACK: activity is stored as an icon	
		this.$.activityPopup.setHeader({
			icon: icon.icon,
			colorized: true,
			name: activity.instances[0].metadata.title,
			title: null,
			action: enyo.bind(this, "runCurrentActivity"),
			data: [activity, null]
		});
		this.$.activityPopup.setItems(null);		
		var items = [];
		items.push({
			icon: {directory: "icons", icon: "activity-start.svg"},
			colorized: false,
			name: l10n.get("Restart"),
			action: enyo.bind(this, "runCurrentActivity"),
			data: [activity, null]
		});
		this.$.activityPopup.setFooter(items);
		
		// Show popup
		this.$.activityPopup.showPopup();		
	},
	hideActivityPopup: function() {
		if (this.$.activityPopup.cursorIsInside())
			return false;	
		this.$.activityPopup.hidePopup();
		return true;	
	},
	
	// Switch journal
	showLocalJournal: function() {
		this.$.journalbutton.addRemoveClass('active', true);
		this.$.cloudonebutton.addRemoveClass('active', false);	
		this.$.cloudallbutton.addRemoveClass('active', false);	
	},

	showPrivateCloud: function() {
		this.$.journalbutton.addRemoveClass('active', false);
		this.$.cloudonebutton.addRemoveClass('active', true);	
		this.$.cloudallbutton.addRemoveClass('active', false);	
	},

	showSharedCloud: function() {
		this.$.journalbutton.addRemoveClass('active', false);
		this.$.cloudonebutton.addRemoveClass('active', false);	
		this.$.cloudallbutton.addRemoveClass('active', true);		
	}
});





// Class for journal toolbar
enyo.kind({
	name: "Sugar.Journal.Toolbar",
	kind: enyo.Control,
	components: [
		{name: "favoritebutton", kind: "Sugar.Icon", x: 374, y: 4, icon: {directory: "icons", icon: "emblem-favorite.svg"}, size: constant.iconSizeList, ontap: "filterFavorite", onclick: "filterFavorite"},
		{name: "journalsearch", kind: "Sugar.SearchField", onTextChanged: "filterEntries", classes: "journal-filter-text"},
		{name: "radialbutton", kind: "Button", classes: "toolbutton view-desktop-button", title:"Home", title:"Home", ontap: "gotoDesktop", onclick: "gotoDesktop"},
		{name: "typeselect", kind: "Sugar.SelectBox", classes: "journal-filter-type", onIndexChanged: "filterEntries"},
		{name: "timeselect", kind: "Sugar.SelectBox", classes: "journal-filter-time", onIndexChanged: "filterEntries"}	
	],
	
	// Constructor
	create: function() {
		// Localize items
		this.inherited(arguments);		
		this.$.journalsearch.setPlaceholder(l10n.get("SearchJournal"));
		
		// Set time selectbox content
		this.$.timeselect.setItems([
			{icon: null, name: l10n.get("Anytime")},
			{icon: null, name: l10n.get("Today")},
			{icon: null, name: l10n.get("SinceYesterday")},
			{icon: null, name: l10n.get("PastWeek")},
			{icon: null, name: l10n.get("PastMonth")},
			{icon: null, name: l10n.get("PastYear")}
		]);
		
		// Set type selectbox content
		var items = [];
		items.push({icon: null, name: l10n.get("Anything")});
		var activities = preferences.getActivities();
		for(var i = 0 ; i < activities.length ; i++)
			items.push({icon: activities[i], name: activities[i].name});
		this.$.typeselect.setItems(items);
	},
	
	rendered: function() {
		this.$.favoritebutton.setNodeProperty("title", l10n.get("FilterFavorites"));
		this.$.radialbutton.setNodeProperty("title", l10n.get("Home"));	
	},

	// Event handling
	gotoDesktop: function() {
		app.showView(constant.radialView);
	},
	
	filterFavorite: function() {
		this.$.favoritebutton.setColorized(!this.$.favoritebutton.getColorized());
		this.$.favoritebutton.render();
		this.filterEntries();
	},
	
	// Compute filter
	filterEntries: function() {
		var text = this.$.journalsearch.getText();
		var favorite = this.$.favoritebutton.getColorized() ? true : undefined;
		var selected = this.$.typeselect.getSelected();
		var typeselected = (selected <= 0 ? undefined : preferences.getActivities()[selected-1].activityId);
		selected = this.$.timeselect.getSelected();
		var timeselected = (selected <= 0 ? undefined : selected);
		app.otherview.filterEntries(text, favorite, typeselected, timeselected);
	},
	
	removeFilter: function() {
		this.$.typeselect.setSelected(0);
		this.$.timeselect.setSelected(0);
		this.$.favoritebutton.setColorized(false);
		this.$.journalsearch.setText("");
		this.render();
	}
});
