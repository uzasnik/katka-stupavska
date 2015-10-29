window.Site = {};

Y.use('node', 'squarespace-gallery-ng', function(Y) {

  // This is a temporary hack to get around something broken in Squarespace's
  // common.js file. If you come across this anytime after Friday, July 24th 2015
  // it's probably fixed and, thus, safe to remove this Y.Array.invoke function
  // from this file. -kfoley
  Y.Array.invoke = function(items, name) {
      var args = Y.Array(arguments, 2, true),
          isFunction = Y.Lang.isFunction,
          ret = [];

      Y.Array.each(Y.Array(items), function(item, i) {
          if (item && isFunction(item[name])) {
              ret[i] = item[name].apply(item, args);
          }
      });

      return ret;
  };

  Y.augment(Y.Node, Class.create({
    index: function() {
      var i = 0, elem = this;
      while(elem = elem.previous(elem.get('tagName'))) {
        i++;
      }
      return i;
    }
  }));

  Site.Common = Singleton.create({
    ready: function() {
      // iPad useragent
      if (navigator.userAgent.match(/iPad;.*CPU.*OS 7_\d/i)) {
        Y.one('html').addClass('ipad ios7');
      }

      this.isMobile = !Y.Lang.isUndefined(window.orientation);

      Y.on('domready', this.initialize, this);

      this.checkMobileView();
      Y.one(window).on(['resize','orientationchange'], this.checkMobileView);
    },

    initialize: function() {
      Y.one('body').addClass('loaded');

      if (Y.one('body.collection-type-index')) {
        Site.Index.initialize();
      } else if (Y.one('body.collection-type-gallery')) {
        Site.Gallery.initialize();
      }

      this.bindUI();

      // Handle IE
      if (Y.UA.ie) {
        Y.one('html').addClass('ie' + Y.UA.ie);
      }

    },

    bindUI: function() {

      this.setupMainNav();
      this.setupMobile();
      this.dropdownFix();

      Y.one(window).on('orientationchange',function(){
        window.scrollTo(0,0);
      },this);

    },

    _editControls: Y.one('.squarespace-editable .sqsp-chrome-edit-mode .pill-controls'),
    sqsEditEvents: function () {
      if (this._editControls) {
        this._editoControls.delegate('click', function () {
          // console.log('clicked');
        });
      } else {
        Y.later(200, this, this.sqsEditEvents);
      }
    },

    setupMainNav: function() {
      var social = Y.one('#sqs-social'),
          mainNavWrapper = Y.one('.main-nav .nav-wrapper');

      mainNavWrapper && social && social.appendTo(mainNavWrapper);
    },

    setupMobile: function() {
      Y.one('.ctrl-button.menu').on('click', function(e) {
        e.halt();
        Y.one('body').toggleClass('sqs-mobile-nav-open');

        this.updateAutoPlay();
      }, this);
    },

    dropdownFix: function() {
      if (Y.one('.no-mobile-styles')) {
        Y.all('.folder-child a').each(function(folderLink) {
          var move;
          folderLink.on('touchmove', function() {
            move = true;
          });
          folderLink.on('touchend', function(e) {
            if (!move) {
              e.halt();
              window.location = folderLink.getAttribute('href');
            }
          });
        });
      }

      Y.all('.main-nav .folder').each(function (folderWrapper) {
        var folder = folderWrapper.one('.folder-child-wrapper');

        folderWrapper.on('mouseover', function () {
          var folderHeight = folder.getY() + folder.get('clientHeight');

          if (folderHeight > Y.config.win.innerHeight) {
            folder.setStyles({
              // Magic number, consider making this more programmatic.
              maxHeight: folderHeight - (folderHeight - Y.config.win.innerHeight + 125),
              overflowY: 'auto'
            });
          }
        }, this);

        folderWrapper.on('mouseout', function () {
          folder.setStyles({
            maxHeight: '',
            overflowY: ''
          });
        });
      }, this);
    },

    checkMobileView: function() {

      if (!Y.Lang.isUndefined(window.orientation) || window.innerWidth <= 768) {
        Y.one('html').addClass('mobile-view');
      } else {
        Y.one('html').removeClass('mobile-view');
      }
    },

    updateAutoPlay: function() {
      if (Site.Index.galleryIndex) {
        var enable = !Y.one('body.sqs-mobile-nav-open, body.show-overlay') && Y.Squarespace.Template.getTweakValue('auto-play') === 'true';
        // console.log(enable);
        Site.Index.galleryIndex.set('autoplay', enable);
      }
    },

    updateColorDetect: function() {
      Y.one('#canvas').removeClass('color-weight-dark').removeClass('color-weight-light');

      var slideImage = Y.one('.slideshow .sqs-active-slide img');
      var color = slideImage && slideImage.getAttribute('data-color-topleft');
      if (color) {
        Y.one('#canvas').addClass('color-weight-' + this._getLightness(color));
      }
    },

    _getLightness: function(hexcolor) {
      if (hexcolor && hexcolor.length > 0 && hexcolor.length <= 7) {
        hexcolor = hexcolor.replace('#', '');
        return ((parseInt(hexcolor, 16) > 0xffffff/2) ? 'light' : 'dark');
      } else {
        return '';
      }
    },

    setupNavigation: function() {
      if (Y.one('.slideshow').all('.slide').size() <= 1) {
        return;
      }

      Y.one('.arrow-wrapper.right').addClass('guide');

      if (!Site.Common.isMobile) {
        var bTimer = Y.later(2000, this, function() {
          Y.all('.arrow-wrapper').removeClass('guide');
        });

        Y.one('body').on('mousemove', function(event) {
          if(event.clientX <= Y.one('body').get('winWidth')/2 && Y.one('#fullscreenBrowser .sqs-active-slide').previous()) {
            Y.one('.arrow-wrapper.left').addClass('guide').siblings().removeClass('guide');
          } else if(event.clientX > Y.one('body').get('winWidth')/2 && Y.one('#fullscreenBrowser .sqs-active-slide').next()) {
            Y.one('.arrow-wrapper.right').addClass('guide').siblings().removeClass('guide');
          }

          bTimer && bTimer.cancel();
        });

        Y.one('#topNav').on('mousemove', function(event) {
          event.halt();

          bTimer.cancel();
        });

        Y.one('body').on('mouseleave', function() {
          Y.all('.arrow-wrapper').removeClass('guide');
        });
      }
      // else {
      //   Y.all('.arrow-wrapper').addClass('guide');
      // }

    }

  });

  Site.Index = Singleton.create({
    initialize: function() {
      this.galleryEl = Y.one('.slideshow');
      this.setupGallery();
      this.bindUI();
      Site.Common.setupNavigation();
      this.setupTweakHandler();
    },

    setupGallery: function() {
      var currentIndex = 0;
      if (window.location.hash.match(/itemId/)) {
        var item = Y.one('.slide[data-slide-id="'+(new Y.HistoryHash()).get('itemId')+'"]');
        currentIndex = item ? item.index() : 0;
      }

      var transition = Site.Common.isMobile ? 'swipe' : 'scroll';

      this.galleryIndex = new Y.Squarespace.Gallery2({
          currentIndex: currentIndex,
          container: this.galleryEl,
          lazyLoad: true,
          design: 'stacked',
          refreshOnResize: true,
          refreshOnOrientationChange: true,
          autoplay: Y.Squarespace.Template.getTweakValue('auto-play') === 'true',
          loop: Y.Squarespace.Template.getTweakValue('auto-play') === 'true',
          autoplayOptions: {
            randomize: false,
            timeout: parseInt(Y.Squarespace.Template.getTweakValue('galleryAutoPlayDelay')) * 1000
          },
          designOptions: {
            easing: Y.Easing.easeOutStrong,
            speed: 0.5,
            autoHeight: false,
            clickBehavior: false,
            transition: Y.Squarespace.Template.getTweakValue('index-transition') === 'Fade' ? 'fade' : transition
          },
          elements: {
            next: '.arrow-wrapper.right',
            previous: '.arrow-wrapper.left'
          },
          loaderOptions: { mode: 'fill' }
      });

      this.galleryIndex.after('currentIndexChange', function(event) {
        var activeSlide = Y.one('.sqs-active-slide');

        // if (Modernizr.touch) {
        //   Y.all('.arrow-wrapper').removeClass('guide');
        // }

        if (!activeSlide.previous()) {
          Y.one('.arrow-wrapper.left').removeClass('guide');
        } else if (!activeSlide.next()) {
          Y.one('.arrow-wrapper.right').removeClass('guide');
        }

        Site.Common.updateColorDetect();
      }, this);

      Site.Common.updateColorDetect();
    },

    bindUI: function() {

      if (!Site.Common.isMobile) {
        Y.one('.slideshow').on('click', function(event) {
          if(event.target.ancestor('.sqs-video-wrapper, .collection-detail-wrapper, [data-type="video"]') || Y.all('.slideshow .slide').size() <= 1) {
            return;
          }

          if (Y.Squarespace.Template.getTweakValue('slides-click-through') === 'true') {
            var slideUrl = '/' + event.target.ancestor('.slide').getAttribute('data-slide-url');
            window.location = slideUrl;
          } else {
            if(event.clientX > Y.one('body').get('winWidth')/2) {
              this.galleryIndex.nextSlide();
            } else {
              this.galleryIndex.previousSlide();
            }
          }

        }, this);

        var timer;
        Y.one('#headerWrapper').on('hover', function() {
          Y.all('.index-overlay').setStyle('visibility', 'visible');
          Y.one('body').addClass('show-overlay');
          Site.Common.updateAutoPlay();
          timer && timer.cancel();
        }, function() {
          Y.one('body').removeClass('show-overlay');
          Site.Common.updateAutoPlay();
          timer && timer.cancel();
          timer = Y.later(500, this, function() {
            Y.all('.index-overlay').setStyle('visibility', 'hidden');
          });
        });
      }
    },

    setupTweakHandler: function() {
      var bRefresh = false;

      if (Y.Global) {
        Y.Global.on('tweak:change', Y.bind(function(f){
          var name = f.getName();
          if (name === 'auto-play') {
            this.galleryIndex.set('autoplay', f.getValue());
            this.galleryIndex.set('loop', f.getValue());
          } else if (name === 'galleryAutoPlayDelay') {
            this.galleryIndex.set('autoplayOptions.timeout', parseInt(f.getValue(), 10) * 1000);
          } else if (name.match(/transition/)) {
            bRefresh = true;
          }
        }, this));

        Y.Global.on('tweak:close', Y.bind(function(f){
          if (bRefresh) {
            window.location.reload(true);
          }
        }));
      }
    }

  });

  Site.Gallery = Singleton.create({
    initialize: function() {
      this.galleryStripEl = Y.one('.slideshow.strip');
      this.galleryStackedEl = Y.one('.slideshow.stacked');
      this.setupGalleries();
      Site.Common.setupNavigation();
      this.bindUI();
      this.setupTweakHandler();
    },

    setupGalleries: function() {
      var currentIndex = 0;
      // if (window.location.hash.match(/itemId/)) {
      //   var item = Y.one('.slide[data-slide-id="'+(new Y.HistoryHash()).get('itemId')+'"]');
      //   currentIndex = item ? item.index() : 0;
      // }

      var adjustHeight = function() {
        var viewportH = Y.one('#fullscreenBrowser').get('winHeight');
        var headerH = Math.max(Y.one('#headerWrapper').height(), (viewportH - 500)/2);
        Y.one('.slideshow.strip') && Y.one('.slideshow.strip').setStyles({
          height: viewportH - 2*headerH,
          marginTop: headerH
        });
        Y.all('.strip .image-detail-wrapper').setStyles({
          bottom: '-' + headerH + 'px',
          height: headerH
        });
      };

      var resizeGalleryStrip = Y.bind(function() {
        this.galleryStrip.getSlides('image').each(function(slide) {

          var slideWidth = slide.get('offsetWidth');
          var img = slide.setStyle('width', null).one('img');

          ImageLoader.load(img);
          img.setStyles({
            top: 0,
            left: 0,
            height: 'auto'
          });

          // reflow
          img.get('offsetWidth');
          img.setStyle('height', null);
          img.get('offsetWidth');

          if (slideWidth < slide.one('img').get('offsetWidth')) {
            slide.setStyle('width', this.galleryStrip.get('container').width());
            img.loader.set('mode','fit').fire('refresh');
          }
        }, this);

        this.galleryStrip['gallery-design'].syncUI();
        Y.later(600, this, function() { // hack to handle multiple refreshes
          this.galleryStripEl.addClass('rendered');
        });
      }, this);

      adjustHeight();

      this.galleryStrip = new Y.Squarespace.Gallery2({
        container: this.galleryStripEl,
        design: 'strip',
        lazyLoad: true,
        loop: true,
        historyHash: true,
        elements: {
          next: '.arrow-wrapper.right',
          previous: '.arrow-wrapper.left'
        },
        refreshOnResize: true,
        refreshOnOrientationChange: true,
        designOptions: {
          alignment: 'start',
          activeSlideClickBehavior: false,
          speed: 0.4,
          easing: Y.Easing.easeOutStrong
        }
      });

      if (this.galleryStrip['gallery-design']){
        this.galleryStrip['gallery-design']._syncUIRefreshWrapperWidth = this._syncUIRefreshWrapperWidth;
        this.galleryStrip['gallery-design']._flushEvents();
        this.galleryStrip['gallery-design'].bindUI();
        this.galleryStrip['gallery-design'].get('host').on('image-loaded', this.galleryStrip['gallery-design']._syncUIRefreshWrapperWidth, this.galleryStrip['gallery-design']);

        resizeGalleryStrip();
      }


      Y.later(100, this, function() {
        this.setupLightbox( this.galleryStripEl.all('.slide').indexOf(Y.one('.sqs-active-slide')) );
      });

      this.galleryStrip.after('currentIndexChange', function(e) {
        var activeSlide = this.galleryStripEl.one('.sqs-active-slide');

        if (Modernizr.touch) {
          Y.all('.arrow-wrapper').removeClass('guide');
        }

        Y.all('.arrow-wrapper.last').removeClass('last');
        if (!activeSlide.previous()) {
          Y.one('.arrow-wrapper.left').removeClass('guide');
        } else if (!activeSlide.next()) {
          Y.one('.arrow-wrapper.right').addClass('last');
        }

      }, this);

      Y.one(window).on(['resize','orientationchange'], function() {
        adjustHeight();
        resizeGalleryStrip();
      });
    },

    setupLightbox: function( index ) {
      this.galleryStacked = new Y.Squarespace.Gallery2({
        currentIndex: index || 0,
        container: this.galleryStackedEl,
        slides: '.slide',
        design: 'stacked',
        lazyLoad: true,
        loop: true,
        historyHash: true,
        refreshOnResize: true,
        refreshOnOrientationChange: true,
        designOptions: {
          easing: Y.Easing.easeOutStrong,
          speed: 0.5,
          autoHeight: false,
          clickBehavior: false,
          transition: Y.Squarespace.Template.getTweakValue('lightbox-transition') === 'Fade' ? 'fade' : 'scroll'
        },
        loaderOptions: { mode: 'fit' }
      });

      this.galleryStrip.addChild(this.galleryStacked);

      this.galleryStacked.after('currentIndexChange', function(e) {
        Site.Common.updateColorDetect();
      }, this);

    },

    bindUI: function() {
      if (!Site.Common.isMobile) {
        this.galleryStackedEl.on('click', function(event) {
          if(!Y.one('body').hasClass('show-expanded') || event.target.ancestor('.sqs-video-wrapper, .collection-detail-wrapper')
            || Y.all('.slideshow .slide').size() <= 1) {
            return;
          }

          if(event.clientX > Y.one('body').get('winWidth')/2) {
            this.galleryStacked.nextSlide();
          } else {
            this.galleryStacked.previousSlide();
          }

        }, this);

        Y.one('.ctrl-button.close').on('click', this.close, this);

        this.galleryStripEl.all('.slide').each(function(slide) {

          // prevent slider from shifting slides that dont need to be shifted
          // except when they have a clickthru url (since the click handler handles it)
          var imgNode = slide.one('img');
          if (imgNode) {
            imgNode.on('click', function(e) {
              if (Y.one('body.nav-disabled') && !e.currentTarget.getAttribute('data-click-through-url')) {
                e.halt();
              }
            });
          }

          slide.one('.ctrl-button.resize').on('click', function(e) {
            e.halt();

            var currentIndex = this.galleryStrip.get('currentIndex');
            var slideIndex = slide.index();

            if (currentIndex !== slideIndex) {
              this.galleryStrip.set('currentIndex', slideIndex);
              this.galleryStacked.set('currentIndex', slideIndex);
            }

            Site.Common.updateColorDetect();

            Y.one('body').addClass('show-expanded');
            Y.one('.ctrl-button.close').setStyle('visibility', 'visible');

            this.ignoreBodyClicks = true;
            Y.Squarespace.EscManager.addTarget(this);
          }, this);

          var slideInfo = slide.one('.image-detail-wrapper'), slideHeight, slideScrollHeight;

          if (!slideInfo) {
            return;
          }

          slideInfo.on('hover', function() {
            slideHeight = slideInfo.height();
            slideScrollHeight = slideInfo.get('scrollHeight');

            if (slideHeight < slideScrollHeight) {
              slideInfo.anim({}, {
                from: { height: slideHeight },
                to: { height: slideScrollHeight + 30 }
              }, {
                duration: 1,
                easing: Y.Easing.easeOutStrong
              }).run();
            }
          }, function() {
            slideInfo.anim({}, {
              to: { height: slideHeight }
            }, {
              duration: 1,
              easing: Y.Easing.easeOutStrong
            }).run().on('end', function() {
              slideInfo.set('scrollTop', 0);
            });
          });

        }, this);
      }

    },

    // Close lightbox... named this way so EscManager can invoke it
    close: function() {
      Y.one('body').removeClass('show-expanded');
      Y.later(500, this, function() {
        Y.one('.ctrl-button.close').setStyle('visibility', null);
      });

      Y.Squarespace.EscManager.removeTarget(this);
    },

    /**
     * This is borrowed from util.js to remove the template level dependency
     * on Y.Squarespace.Rendering.
     *
     * @method getWidthForHeight
     * @param  {Number} oWidth
     * @param  {Number} oHeight
     * @param  {Number} height
     * @return {Number}
     */
    getWidthForHeight: function (oWidth, oHeight, height) {
      return (oWidth / oHeight) * height;
    },

    /**
     * This is borrowed from util.js to remove the template level dependency
     * on Y.Squarespace.Rendering.
     *
     * @method getDimensionsFromNode
     * @param  {Node} node
     * @return {Object}
     */
    getDimensionsFromNode: function (node) {
      var val = node.getAttribute('data-image-dimensions');

      if (!val) {
        return {
          width: null,
          height: null
        };
      } else if (Y.Lang.isString(val)) {
        val = val.split('x');
        return {
          width: parseInt(val[0], 10),
          height: parseInt(val[1], 10)
        };
      }
    },

    _syncUIRefreshWrapperWidth: function() {
      if (this.get('host').get('container').hasClass('sqs.gallery-thumbnails')) {
        var thumbnailsEl = this.get('host').get('container');
        var thumbnailHeight = thumbnailsEl.get('offsetHeight');

        thumbnailsEl.all('.sqs-video-thumbnail').each(function(videoThumbnailEl) {
          if (videoThumbnailEl.hasClass('no-image')) {
            videoThumbnailEl.one('.sqs-video-thumbnail-inner').setStyles({
              'width': Math.floor(thumbnailHeight*(16/9)) + 'px'
            });
          }

          var imgEl = videoThumbnailEl.one('img');
          if (imgEl) {
            videoThumbnailEl.removeClass('loading');
            videoThumbnailEl.setAttribute('style', "width: " + imgEl.get('offsetWidth') + 'px !important');
          }
        });
      }

      // recalculate the wrapper width
      var wrapperEl = this.get('host')._wrapperEl;

      wrapperEl.setStyles({
        width: null
      });

      // evaluate the container width
      var containerWidth = this.get('host').get('container').get('offsetWidth');
      var containerHeight = this.get('host').get('container').get('offsetHeight');
      var currentSlide = this.get('host')._currentSlide();
      var wrapperWidth = 0;
      var slideOffset = 0;
      var imageCount = Y.all('.slideshow .slide').size();

      this.get('host').get('slides').each(function(slide, n) {

        var slideContent = slide.one('img, .sqs-video-wrapper');

        var dims;
        if (slideContent.videoloader) {
          dims = {
            width: slideContent.videoloader.getWidth(),
            height: slideContent.videoloader.getHeight()
          };
        } else {
          dims = Site.Gallery.getDimensionsFromNode(slideContent);
        }

        var slideWidth = 15 + Site.Gallery.getWidthForHeight(dims.width, dims.height, containerHeight);

        if (this.get('host').get('currentIndex') > n) {
          slideOffset += slideWidth;
        }

        wrapperWidth += slideWidth;
      }, this);

      // figure out how much we need to offset that last image.
      switch (this.get('alignment')) {
        case 'start':
          // DO NOTHING.
        break;
        case 'middle':
          slideOffset -= (containerWidth - currentSlide.get('offsetWidth')) / 2;
          if (slideOffset < 0) { slideOffset = 0; }
        break;
        case 'end':
          slideOffset -= (containerWidth - currentSlide.get('offsetWidth'));
          if (slideOffset < 0) { slideOffset = 0; }
        break;
      }

      // if the wrapper is bigger than the container,
      // center the strip.
      if (wrapperWidth < containerWidth) {
        slideOffset = (containerWidth - 35 - wrapperWidth) / -2;
        Y.one('body').addClass('nav-disabled');
      } else {
        Y.one('body').removeClass('nav-disabled');
        // slideOffset = (wrapperWidth - containerWidth);
      }

      // set the wrapper element to twice what it needs to be, it doesn't really matter.
      // plus, twice is always better.
      wrapperEl.setStyles({
        width: wrapperWidth * 2
      });

      // animate the wrapper to the right position
      var ctx = this;
      var currentLeft = 0;
      var parsedLeft = parseInt(wrapperEl.getComputedStyle('left'), 10);
      if (Y.Lang.isNumber(parsedLeft)) {
        currentLeft = parsedLeft;
      }

      /*
        The execution logic here tests a rare use case in which
        galleries with a lot of images snap into place. It looks
        really janky.

        Execute is set to false on large galleries that are initiating
        on the first image.
      */
      var execute;
      if (imageCount > 25 && !Y.one('.gallery-initiated') && slideOffset === 0) {
        execute = false;
      } else {
        execute = true;
      }

      if (execute === false) {
        wrapperEl.setStyle('left', '0px');
      }

      JSTween.tween(wrapperEl.getDOMNode(), {
        left: {
          start: parsedLeft,
          stop: -1 * slideOffset,
          time: 0,
          duration: 0.4,
          effect: 'expoOut',
          onStart: function() {
            ctx.get('host').set('inMotion', true);
          },
          onStop: function() {
            ctx.get('host').set('inMotion', false);
          }
        }
      });

      if (execute === true) {
        JSTween.play();
        !Y.one('.gallery-initiated') && wrapperEl.addClass('gallery-initiated');
      }
    },

    setupTweakHandler: function() {
      var bRefresh = false;

      if (Y.Global) {
        Y.Global.on('tweak:change', Y.bind(function(f){
          var name = f.getName();
          if (name.match(/transition/)) {
            bRefresh = true;
          }
        }, this));

        Y.Global.on('tweak:close', Y.bind(function(f){
          if (bRefresh) {
            window.location.reload(true);
          }
        }));
      }
    }

  });

});
