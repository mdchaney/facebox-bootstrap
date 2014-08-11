/*
 * Facebox-Bootstrap (for jQuery v1.2+ & Bootstrap v3)
 * version: 0.9
 *
 * Licensed under the MIT:
 *   http://www.opensource.org/licenses/mit-license.php
 *
 * Copyright Forever Chris Wanstrath, Kyle Neath, Michael Chaney
 *
 * Based on the awesomely simple "facebox" code by Chris Wanstrath,
 * later maintained by Kyle Neath.
 *
 * This is a simple shim to allow the standard Bootstrap modal to be
 * used in the same manner as the older "facebox" jquery plugin.  The
 * main difference is that facebox - when given a link - will load the
 * remote resource each time it is called.  The Bootstrap modal will
 * only load it one time.  The Bootstrap modal also relies on having the
 * modal DOM in the document ready to be shown whereas the facebox code
 * only adds it when needed.
 *
 * To use this, simply remove facebox.js and facebox.css and drop this
 * in after you include Bootstrap's js.
 *
 * Note: this is meant to be a straight drop-in replacement.  It should
 * work nicely if you do nothing else.  However, I have specifically
 * created it so that you can update your code incrementally to fit
 * Bootstrap better as time permits.
 *
 * This shim simply creates the appropriate DOM object when invoked,
 * fills it in, and then uses the Bootstrap modal to show it.  If
 * invoked in "straight" mode it'll pass the url directly to Bootstrap
 * and allow it to handle the ajax call to load data.  Note that this is
 * not just like Bootstrap's regular call as this will load the data
 * afresh each time it's called.
 *
 * $.facebox.settings.compatibility = 'normal'
 * $.facebox.settings.compatibility = 'straight'
 *
 * In straight mode, URLs are handed off to Boostrap's standard code
 * which will load the data into the "modal-content" div.
 *
 * In normal mode facebox loads the data itself and examines it.  If it
 * includes a "modal-body" div the data will be loaded directly into
 * "modal-content" as in straight mode.  Otherwise it will be loaded
 * into a "modal-body" div.  Furthermore, the first header of any kind
 * will be removed and its contents inserted into the "h4" in the
 * modal-header div.  This standard modal also has a close "x" in the
 * header and a close button in the footer.
 *
 * All callbacks are mapped to Bootstrap modal callbacks:
 *
 * Bootstrap           Facebox
 *
 * show.bs.modal       loading.facebox, beforeReveal.facebox
 * shown.bs.modal      reveal.facebox, afterReveal.facebox
 * hidden.bs.modal     afterClose.facebox
 *
 * Also, you can trigger "close.facebox" manually to close the modal.
 *
 * This is the original documentation:
 *
 * Usage:
 *
 *  jQuery(document).ready(function() {
 *    jQuery('a[rel*=facebox]').facebox()
 *  })
 *
 *  <a href="#terms" rel="facebox">Terms</a>
 *    Loads the #terms div in the box
 *
 *  <a href="terms.html" rel="facebox">Terms</a>
 *    Loads the terms.html page in the box
 *
 *  <a href="terms.png" rel="facebox">Terms</a>
 *    Loads the terms.png image in the box
 *
 *
 *  You can also use it programmatically:
 *
 *    jQuery.facebox('some html')
 *    jQuery.facebox('some html', 'my-groovy-style')
 *
 *  The above will open a facebox with "some html" as the content.
 *
 *    jQuery.facebox(function($) {
 *      $.get('blah.html', function(data) { $.facebox(data) })
 *    })
 *
 *  The above will show a loading screen before the passed function is called,
 *  allowing for a better ajaxy experience.
 *
 *  The facebox function can also display an ajax page, an image, or the contents of a div:
 *
 *    jQuery.facebox({ ajax: 'remote.html' })
 *    jQuery.facebox({ ajax: 'remote.html' }, 'my-groovy-style')
 *    jQuery.facebox({ image: 'stairs.jpg' })
 *    jQuery.facebox({ image: 'stairs.jpg' }, 'my-groovy-style')
 *    jQuery.facebox({ div: '#box' })
 *    jQuery.facebox({ div: '#box' }, 'my-groovy-style')
 *
 *  Want to close the facebox?  Trigger the 'close.facebox' document event:
 *
 *    jQuery(document).trigger('close.facebox')
 *
 *  Facebox also has a bunch of other hooks:
 *
 *    loading.facebox
 *    beforeReveal.facebox
 *    reveal.facebox (aliased as 'afterReveal.facebox')
 *    init.facebox
 *    afterClose.facebox
 *
 *  Simply bind a function to any of these hooks:
 *
 *   $(document).bind('reveal.facebox', function() { ...stuff to do after the facebox and contents are revealed... })
 *
 */
(function($) {
  $.facebox = function(data, klass) {
    $.facebox.loading(data.settings || [])

    if (data.ajax) fillFaceboxFromLink(data.ajax, klass)
    else if (data.image) fillFaceboxFromImage(data.image, klass)
    else if (data.div) fillFaceboxFromHref(data.div, klass)
    else if ($.isFunction(data)) data.call($)
    else $.facebox.reveal(data, klass)
  }

  /*
   * Public, $.facebox methods
   */

  $.extend($.facebox, {
    settings: {
      modalSize    : null,      // null, 'large', or 'small'
      compatibility: 'normal',  // straight or normal
      imageTypes   : [ 'png', 'jpg', 'jpeg', 'gif' ],
      faceboxMinimalHtml  : '\
    <div class="modal fade" id="facebox" tabindex="-1" role="dialog" aria-labelledby="fbModalLabel" ar ia-hidden="true"> \
      <div class="modal-dialog modal-lg"> \
        <div class="modal-content"> \
        </div> \
      </div> \
    </div> \
    ',
    faceboxHtml    : '\
<div class="modal fade" id="facebox" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true"> \
  <div class="modal-dialog"> \
    <div class="modal-content"> \
      <div class="modal-header"> \
        <button type="button" class="close" data-dismiss="modal"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button> \
        <h4 class="modal-title" id="myModalLabel"></h4> \
      </div> \
      <div class="modal-body content"> \
      </div> \
      <div class="modal-footer"> \
        <button type="button" class="btn btn-default" data-dismiss="modal">Close</button> \
      </div> \
    </div> \
  </div> \
</div> \
    '
    },

    loading: function() {
      init()
      if ($.facebox.current_modal) return true;

      if ($.facebox.settings.compatibility=='straight') {
        $.facebox.current_modal = $($.facebox.settings.faceboxMinimalHtml);
      } else {
        $.facebox.current_modal = $($.facebox.settings.faceboxHtml);
      }

      if ($.facebox.settings.modalSize == 'small') {
        $.facebox.current_modal.find('.modal-dialog').addClass('modal-sm');
      } else if ($.facebox.settings.modalSize == 'large') {
        $.facebox.current_modal.find('.modal-dialog').addClass('modal-lg');
      }
    },

    // In this case, show a remote link
    revealRemote: function(link, klass) {
      if (klass) $.facebox.current_modal.addClass(klass)
      $.facebox.current_modal.modal({remote: link});
    },

    // data is literal data to stick in the modal
    reveal: function(data, klass) {
      if (klass) $.facebox.current_modal.addClass(klass)
      $.facebox.current_modal.find('.modal-body').append(data);
      $.facebox.current_modal.modal();
    },

    // Takes literal data and examines it.  If the literal data has a
    // "modal-body" div, then the data will replace the entire
    // "modal-content" div of the modal.  Otherwise, the data will be
    // stuck into "modal-body".  Additionally, the first header (h1-h6)
    // will be removed and its contents put into an h4 in the modal
    // header.
    revealNormal: function(data, klass) {
      if (klass) $.facebox.current_modal.addClass(klass)
      if (data.match(/class\s*=\s*["']modal-body/)) {
        $.facebox.current_modal.find('.modal-content').empty().append(data);
      } else {
        var header_match_data = data.match(/<(h[123456]).*?>(.*?)(<\/\1>)/);
        if (header_match_data) {
          $.facebox.current_modal.find('.modal-header h4').empty().append(header_match_data[2]);
          data = data.replace(new RegExp(header_match_data[0]),'');
        } else {
          $.facebox.current_modal.find('.modal-header h4').remove();
        }
        $.facebox.current_modal.find('.modal-body').append(data);
      }
      $.facebox.current_modal.modal();
    },

    close: function() {
      $(document).trigger('close.facebox')
      return false
    }
  })

  /*
   * Public, $.fn methods
   */

  $.fn.facebox = function(settings) {
    if ($(this).length == 0) return

    init(settings)

    function clickHandler() {
      $.facebox.loading(true)

      // support for rel="facebox.inline_popup" syntax, to add a class
      // also supports deprecated "facebox[.inline_popup]" syntax
      var klass = this.rel.match(/facebox\[?\.(\w+)\]?/)
      if (klass) klass = klass[1]

      fillFaceboxFromHref(this.href, klass)
      return false
    }

    return this.bind('click.facebox', clickHandler)
  }

  /*
   * Private methods
   */

  // called one time to setup facebox on this page
  function init(settings) {
    if ($.facebox.settings.inited) return true
    else $.facebox.settings.inited = true

    $(document).trigger('init.facebox')
    makeCompatible()

    var imageTypes = $.facebox.settings.imageTypes.join('|')
    $.facebox.settings.imageTypesRegexp = new RegExp('\\.(' + imageTypes + ')(\\?.*)?$', 'i')

    // This will hold the current modal
    $.facebox.current_modal = null;

    if (settings) $.extend($.facebox.settings, settings)

    $(document).on('show.bs.modal', function() {
      $(document).trigger('loading.facebox').trigger('beforeReveal.facebox');
    });

    $(document).on('shown.bs.modal', function() {
      $(document).trigger('reveal.facebox').trigger('afterReveal.facebox')
    });

    $(document).on('hidden.bs.modal', function() {
      $(document).trigger('afterClose.facebox');
      $.facebox.current_modal.remove();
      $.facebox.current_modal = null;
    });
  }

  // Backwards compatibility
  function makeCompatible() {
    var $s = $.facebox.settings

    $s.loadingImage = $s.loading_image || $s.loadingImage
    $s.closeImage = $s.close_image || $s.closeImage
    $s.imageTypes = $s.image_types || $s.imageTypes
    $s.faceboxHtml = $s.facebox_html || $s.faceboxHtml
  }

  // Figures out what you want to display and displays it
  // formats are:
  //     div: #id
  //   image: blah.extension
  //    ajax: anything else
  function fillFaceboxFromHref(href, klass) {
    // div
    if (href.match(/#/)) {
      var url    = window.location.href.split('#')[0]
      var target = href.replace(url,'')
      if (target == '#') return
      $.facebox.reveal($(target).html(), klass)

    // image
    } else if (href.match($.facebox.settings.imageTypesRegexp)) {
      fillFaceboxFromImage(href, klass)
    // ajax
    } else {
      fillFaceboxFromLink(href, klass)
    }
  }

  function fillFaceboxFromImage(href, klass) {
    var image = new Image()
    image.onload = function() {
      $.facebox.reveal('<div class="image"><img src="' + image.src + '" /></div>', klass)
    }
    image.src = href
  }

  function fillFaceboxFromLink(href, klass) {
    if ($.facebox.settings.compatibility == 'normal') {
      $.facebox.jqxhr = $.get(href, function(data) { $.facebox.revealNormal(data, klass) }, 'text');
    } else {
      $.facebox.revealRemote(href, klass);
    }
  }

  /*
   * Bindings
   */

  $(document).bind('close.facebox', function() {
    $.facebox.current_modal.modal('hide');
  });

})(jQuery);
