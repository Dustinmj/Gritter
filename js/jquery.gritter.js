/*
 * Gritter for jQuery
 * http://www.boedesign.com/
 *
 * Copyright (c) 2012 Jordan Boesch
 * Dual licensed under the MIT and GPL licenses.
 *
 * Date: February 24, 2012
 * Version: 1.8
 */

(function($){
 	
	/**
	* Set it up as an object under the jQuery namespace
	*/
	$.gritter = {};
	
	/**
	* Set up global options that the user can over-ride
	*/
	$.gritter.options = {
   /**************** 
         REQUIRED
   ****************/
      text:'',

   /****************
         OPTIONAL
   ****************/
      title:'', // title for the notification
      sticky: false, // fade out on it's own?
      image: undefined, // url of an image to show

		position: 'tr', // {string} 'tl', 'tr', 'br', 'bl', where should the notifications be located?
		class_name: '', // could be set to 'gritter-light' to use white notifications

      fade_out: true, // whether or not to fade out
		fade_in_speed: 'medium', // how fast notifications fade in
		fade_out_speed: 1000, // how fast the notices fade out
		time: 6000, // hang on the screen for...

		collapse_speed: 300, // how fast the notices collapse
		delay_collapse: true, // if true, element doesn't collapse
		                      // until completely faded, if false, collapse happens simultaneously

		maximum: -1, // maximum growls to appear
		overflow_collapse_speed: 250, // how fast should collapse occur when maximum is exceeded
      overflow_fade_out_speed: 600, // how fast should fade out occur when maximum is exceeded (if delayed)
      overflow_delay_collapse: false, // delay collapse when maximum is exceeded?
      overflow_kills_sticky: false, // does the bubbling effect remove sticky notifications?

      before_open: function(){}, // callbacks
      after_open: function(){},
      before_close: function(){},
      after_close: function(){}
	};
	
	/**
	* Add a gritter notification to the screen
	* @see Gritter#add();
	*/
	$.gritter.add = function(params){

		try {
			return $.gritter._implementation.add(params || {});
		} catch(e) {
		
			var err = 'Gritter Error: ' + e;
			(typeof(console) != 'undefined' && console.error) ? 
				console.error(err, params) : 
				alert(err);
				
		}
		
	}
	
	/**
	* Remove a gritter notification from the screen
	* @see Gritter#removeSpecific();
	*/
	$.gritter.remove = function(id, params){
		$.gritter._implementation.removeSpecific(id, params || {});
	}
	
	/**
	* Remove all notifications
	* @see Gritter#stop();
	*/
	$.gritter.removeAll = function(params){
		$.gritter._implementation.stop(params || {});
	}
	
	/**
	* Big fat Gritter object
	* @constructor (not really since its object literal)
	*/
	$.gritter._implementation = {
		
		// Private - no touchy the private parts
		_custom_timer: 0,
		_item_count: 0,
		_is_setup: 0,
		_tpl_close: '<div class="gritter-close"></div>',
		_tpl_title: '<span class="gritter-title">[[title]]</span>',
		_tpl_item: '<div id="gritter-item-[[number]]" class="gritter-item-wrapper [[item_class]]" style="display:none"><div class="gritter-top"></div><div class="gritter-item">[[close]][[image]]<div class="[[class_name]]">[[title]]<p>[[text]]</p></div><div style="clear:both"></div></div><div class="gritter-bottom"></div></div>',
		_tpl_wrap: '<div class="gritter-notice-wrapper"></div>',
		
		/**
		* Add a gritter notification to the screen
		* @param {Object} params The object that contains all the options for drawing the notification
		* @return {Integer} The specific numeric id to that gritter notification
		*/
		add: function(params){
         // store this
         var _self = this;

			// Handle straight text
			if(typeof(params) == 'string'){
				params = {text:params};
			}

         // handle blank input
         for( i in params )
         {
            if( $.trim( params[i].toString() ).length == 0 )
            {
               delete params[i];
            }
         }

			params = $.extend( {}, $.gritter.options, params );

			// We might have some issues if we don't have a title or text!
			if(params.text === null){
				throw 'You must supply "text" parameter.'; 
			}

			this._verifyWrapper( params['position'] );
			
			var number = ++this._item_count,
				tmp = this._tpl_item;
			
			// Assign callbacks
			$(['before_open', 'after_open', 'before_close', 'after_close']).each(function(i, val){
				_self['_' + val + '_' + number] = ($.isFunction(params[val])) ? params[val] : function(){}
			});
			
			var image_str = params[ 'image' ] != undefined ? '<img src="' + params[ 'image' ] + '" class="gritter-image" />' : '',
				class_name = params[ 'image' ] != undefined ? 'gritter-with-image' : 'gritter-without-image';
			
			// String replacements on the template
			if(params.title){
				params.title = this._str_replace('[[title]]',params.title,this._tpl_title);
			}else{
				params.title = '';
			}
			
			tmp = this._str_replace(
				['[[title]]', '[[text]]', '[[close]]', '[[image]]', '[[number]]', '[[class_name]]', '[[item_class]]'],
				[params.title, params.text, this._tpl_close, image_str, this._item_count, class_name, params.class_name], tmp
			);

			// If it's false, don't show another gritter message
			if(this['_before_open_' + number]() === false){
				return false;
			}

			var pos = params['position'];
			this._isUpper( pos ) ? $('.gritter-notice-wrapper.' + params['position'] ).append(tmp)
			                           : $('.gritter-notice-wrapper.' + params['position'] ).prepend(tmp);
			
			var item = $('#gritter-item-' + this._item_count).addClass( 'gritter-static' );
			
			item.fadeIn(params['fade_in_speed'], function(){
				_self['_after_open_' + number]($(this));
			});
			
			if(!params.sticky){
				this._setFadeTimer(item, number, params);
			}else{
			   item.addClass( 'sticky' ); // for bubbler handler
			}
			
			// Bind the hover/unhover states
			$(item).bind('mouseenter mouseleave', function(event){
				if(event.type == 'mouseenter'){
					if(!params.sticky){
						_self._restoreItemIfFading($(this), number);
					}
				}
				else {
					if(!params.sticky){
						_self._setFadeTimer( $(this), number, params );
					}
				}
				_self._hoverState($(this), event.type);
			});
			
			// Clicking (X) makes the perdy thing close
			$(item).find('.gritter-close').click(function(){
				_self.removeSpecific(number, {}, null, true);
			});
			
			this._checkMax( params );

			return number;
		
		},
		
		/**
		* Get the number of currently shown growls
		* @return {Integer}
		*/
		count: function( position ){
		   return $('.gritter-notice-wrapper.' + position).children().length;
		},

		/**
		* Bring everything to a halt
		* @param {Object} params A list of callback functions to pass when all notifications are removed
		*/
		stop: function( params ){
			
			// callbacks (if passed)
			var before_close = ($.isFunction(params.before_close)) ? params.before_close : function(){};
			var after_close = ($.isFunction(params.after_close)) ? params.after_close : function(){};
			
			// we pass all the currently open wrappers to the callbacks
			var wraps = $('.gritter-notice-wrapper');
			console.log( wraps );
			before_close(wraps);
			wraps.fadeOut(function(){
				$(this).remove();
				after_close();
			});
		
		},
		
		/**
		* Remove a specific notification based on an ID
		* @param {Integer} unique_id The ID used to delete a specific notification, can be null if e is specified
		* @param {Object} params A set of options passed in to determine how to get rid of it
		* @param {Object} e The jQuery element that we're "fading" then removing, can be null if unique_id is specified
		* @param {Boolean} unbind_events If we clicked on the (X) we set this to true to unbind mouseenter/mouseleave
		*/
		removeSpecific: function(unique_id, params, e, unbind_events){
			if(!e){
			   if(!unique_id)
			   {
			      throw 'removeSpecific; Either unique_id or e must be specified.';
			   }
				var e = $('#gritter-item-' + unique_id);
			}

			// We set the fourth param to let the _fade function know to 
			// unbind the "mouseleave" event.  Once you click (X) there's no going back!
			this._fade(e, unique_id || this._getIdFromElement( e ), params || {}, unbind_events);
			
		},
		
		/**
		* Does this container sit at the upper portion or lower portion of the screen?
		* @param {string} position
		*/
		_isUpper:function( position ){
		   return position == 'tr' || position == 'tl';
		},

		/**
		* Check whether we've exceeded the maximum number of displayed notifications
		* @param {Object} parameters
		*/
		_checkMax: function( params ){
			// check to see that we're not above the maximum currently
			// if we are, remove the top one
			var staticItems = params.overflow_kills_sticky ?
			                     $( '.gritter-notice-wrapper.' + params['position'] + ' .gritter-static' ) :
			                     $( '.gritter-notice-wrapper.' + params['position'] + ' .gritter-static:not(.sticky)' );
         while( params.maximum  > 0 && staticItems.length > params.maximum )
         {
            // special options for overflow situations
            var p = $.extend( {}, params,  { 
                                                speed: params.overflow_fade_out_speed,
                                                collapse_speed: params.overflow_collapse_speed,
                                                delay_collapse: params.overflow_delay_collapse
                                            });
            // are we pulling the top or lower
            var target = this._isUpper( params['position'] ) ? staticItems.first() : staticItems.last();
            // kill it
            this.removeSpecific( null, p , target  );
			   var staticItems = params.overflow_kills_sticky ?
			                        $( '.gritter-notice-wrapper.' + params['position'] + ' .gritter-static' ) :
			                        $( '.gritter-notice-wrapper.' + params['position'] + ' .gritter-static:not(.sticky)' );
         }
		},

		/**
		* If we don't have any more gritter notifications, get rid of the wrapper using this check
		* @private
		* @param {Integer} unique_id The ID of the element that was just deleted, use it for a callback
		* @param {Object} e The jQuery element that we're going to perform the remove() action on
		* @param {Boolean} manual_close Did we close the gritter dialog with the (X) button
		*/
		_countRemoveWrapper: function(unique_id, e, position, manual_close){
			
			// Remove it then run the callback function
			e.remove();
			this['_after_close_' + unique_id](e, manual_close);
			
			// Check if the wrapper is empty, if it is.. remove the wrapper
			if( this.count( position ) == 0){
				$('.gritter-notice-wrapper.' + position).remove();
			}
		
		},
		
		/**
		* Fade out an element after it's been on the screen for x amount of time
		* @private
		* @param {Object} e The jQuery element to get rid of
		* @param {Integer} unique_id The id of the element to remove
		* @param {Object} params An optional list of params to set fade speeds etc.
		* @param {Boolean} unbind_events Unbind the mouseenter/mouseleave events if they click (X)
		*/
		_fade: function(e, unique_id, params, unbind_events){
         
         // store this
         var _self = this;
         
			this['_before_close_' + unique_id](e, unbind_events);
			
			// If this is true, then we are coming from clicking the (X)
			if(unbind_events){
				e.unbind('mouseenter mouseleave');
			}
			
			// We are not longer static
			e.removeClass( 'gritter-static' );

			// Fade it out or remove it
			if(params.fade_out){

			   if( params.delay_collapse ){

				   e.animate({ opacity: 0 }, params.fade_out_speed, function(){
					   e.animate({ height: 0 }, params.collapse_speed, function(){
						   _self._countRemoveWrapper(unique_id, e, params['position'], unbind_events);
					   })
				   });

				}else{

					e.animate({
					   opacity: 0,
					   height: 0
				   }, {
				         duration: params.collapse_speed, 
				         complete: function(){
				                     _self._countRemoveWrapper(unique_id, e, params['position'], unbind_events);
				                   },
				         queue: false
				   });
				}

			}
			else {
				
				this._countRemoveWrapper(unique_id, e, params['position']);
				
			}
						
		},
		
		/**
		* Perform actions based on the type of bind (mouseenter, mouseleave) 
		* @private
		* @param {Object} e The jQuery element
		* @param {String} type The type of action we're performing: mouseenter or mouseleave
		*/
		_hoverState: function(e, type){
			
			// Change the border styles and add the (X) close button when you hover
			if(type == 'mouseenter'){
				
				e.addClass('hover');
				
				// Show close button
				e.find('.gritter-close').show();
						
			}
			// Remove the border styles and hide (X) close button when you mouse out
			else {
				
				e.removeClass('hover');
				
				// Hide close button
				e.find('.gritter-close').hide();
				
			}
			
		},
		
		/**
		* Get a growl's unique_id from it's element
		* @return {Integer} the growl's unique id
		**/
		_getIdFromElement: function( e ){
		    var m = /gritter-item-([\d]+)/.exec( e.attr( 'id' ) );
		    return m.length > 1 ?
		      parseInt( m[1] ) :
		      null;
		},

		/**
		* If the item is fading out and we hover over it, restore it!
		* @private
		* @param {Object} e The HTML element to remove
		* @param {Integer} unique_id The ID of the element
		*/
		_restoreItemIfFading: function(e, unique_id){
			
			clearTimeout(this['_int_id_' + unique_id]);
			e.stop().css({ opacity: '', height: '' })
			   .addClass( 'gritter-static' ); // add the class back if needed
			
		},
		
		/**
		* Set the notification to fade out after a certain amount of time
		* @private
		* @param {Object} item The HTML element we're dealing with
		* @param {Integer} unique_id The ID of the element
		* @param {Object} the parameters to pass on to the fade sequence
		*/
		_setFadeTimer: function(e, unique_id, params){
			// store this
			var _self = this;
			
			this['_int_id_' + unique_id] = setTimeout(function(){ 
				_self._fade(e, unique_id, params);
			}, params[ 'time' ] );
		
		},
		
		/**
		* An extremely handy PHP function ported to JS, works well for templating
		* @private
		* @param {String/Array} search A list of things to search for
		* @param {String/Array} replace A list of things to replace the searches with
		* @return {String} sa The output
		*/  
		_str_replace: function(search, replace, subject, count){
		
			var i = 0, j = 0, temp = '', repl = '', sl = 0, fl = 0,
				f = [].concat(search),
				r = [].concat(replace),
				s = subject,
				ra = r instanceof Array, sa = s instanceof Array;
			s = [].concat(s);
			
			if(count){
				this.window[count] = 0;
			}
		
			for(i = 0, sl = s.length; i < sl; i++){
				
				if(s[i] === ''){
					continue;
				}
				
				for (j = 0, fl = f.length; j < fl; j++){
					
					temp = s[i] + '';
					repl = ra ? (r[j] !== undefined ? r[j] : '') : r[0];
					s[i] = (temp).split(f[j]).join(repl);
					
					if(count && s[i] !== temp){
						this.window[count] += (temp.length-s[i].length) / f[j].length;
					}
					
				}
			}
			
			return sa ? s : s[0];
			
		},
		
		/**
		* A check to make sure we have something to wrap our notices with
		* @private
		*/  
		_verifyWrapper: function( position ){
		  
			if($('.gritter-notice-wrapper.' + position).length == 0){
				$('body').append( $(this._tpl_wrap).addClass( position ) );
			}
		
		}
		
	}
	
})(jQuery);
