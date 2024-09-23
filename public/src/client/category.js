'use strict';

define('forum/category', [
	'forum/infinitescroll',
	'share',
	'navigator',
	'topicList',
	'sort',
	'categorySelector',
	'hooks',
	'alerts',
	'api',
], function (infinitescroll, share, navigator, topicList, sort, categorySelector, hooks, alerts, api) {
	const Category = {};

	$(window).on('action:ajaxify.start', function (ev, data) {
		if (!String(data.url).startsWith('category/')) {
			navigator.disable();
		}
	});

	Category.init = function () {
		const cid = ajaxify.data.cid;

		app.enterRoom('category_' + cid);

		share.addShareHandlers(ajaxify.data.name);

		topicList.init('category', loadTopicsAfter);

		sort.handleSort('categoryTopicSort', 'category/' + ajaxify.data.slug);

		if (!config.usePagination) {
			navigator.init('[component="category/topic"]', ajaxify.data.topic_count, Category.toTop, Category.toBottom);
		} else {
			navigator.disable();
		}

		handleScrollToTopicIndex();

		handleIgnoreWatch(cid);

		handleLoadMoreSubcategories();

		categorySelector.init($('[component="category-selector"]'), {
			privilege: 'find',
			parentCid: ajaxify.data.cid,
			onSelect: function (category) {
				ajaxify.go('/category/' + category.cid);
			},
		});

		// Add this line to initialize the topic search
		handleTopicSearch();
		testTopicFilter();
		console.log("testing topic filter");

		hooks.fire('action:topics.loaded', { topics: ajaxify.data.topics });
		hooks.fire('action:category.loaded', { cid: ajaxify.data.cid });
	};

	function handleScrollToTopicIndex() {
		let topicIndex = ajaxify.data.topicIndex;
		if (topicIndex && utils.isNumber(topicIndex)) {
			topicIndex = Math.max(0, parseInt(topicIndex, 10));
			if (topicIndex && window.location.search.indexOf('page=') === -1) {
				navigator.scrollToElement($('[component="category/topic"][data-index="' + topicIndex + '"]'), true, 0);
			}
		}
	}

	function handleIgnoreWatch(cid) {
		$('[component="category/watching"], [component="category/tracking"], [component="category/ignoring"], [component="category/notwatching"]').on('click', function () {
			const $this = $(this);
			const state = $this.attr('data-state');

			api.put(`/categories/${cid}/watch`, { state }, (err) => {
				if (err) {
					return alerts.error(err);
				}

				$('[component="category/watching/menu"]').toggleClass('hidden', state !== 'watching');
				$('[component="category/watching/check"]').toggleClass('fa-check', state === 'watching');

				$('[component="category/tracking/menu"]').toggleClass('hidden', state !== 'tracking');
				$('[component="category/tracking/check"]').toggleClass('fa-check', state === 'tracking');

				$('[component="category/notwatching/menu"]').toggleClass('hidden', state !== 'notwatching');
				$('[component="category/notwatching/check"]').toggleClass('fa-check', state === 'notwatching');

				$('[component="category/ignoring/menu"]').toggleClass('hidden', state !== 'ignoring');
				$('[component="category/ignoring/check"]').toggleClass('fa-check', state === 'ignoring');

				alerts.success('[[category:' + state + '.message]]');
			});
		});
	}

	function handleLoadMoreSubcategories() {
		$('[component="category/load-more-subcategories"]').on('click', async function () {
			const btn = $(this);
			const { categories: data } = await api.get(`/categories/${ajaxify.data.cid}/children?start=${ajaxify.data.nextSubCategoryStart}`);
			btn.toggleClass('hidden', !data.length || data.length < ajaxify.data.subCategoriesPerPage);
			if (!data.length) {
				return;
			}
			app.parseAndTranslate('category', 'children', { children: data }, function (html) {
				html.find('.timeago').timeago();
				$('[component="category/subcategory/container"]').append(html);
				ajaxify.data.nextSubCategoryStart += ajaxify.data.subCategoriesPerPage;
				ajaxify.data.subCategoriesLeft -= data.length;
				btn.toggleClass('hidden', ajaxify.data.subCategoriesLeft <= 0)
					.translateText('[[category:x-more-categories, ' + ajaxify.data.subCategoriesLeft + ']]');
			});

			return false;
		});
	}

	// Testing topic filter to search for topics with the word "test" in the title.
	function testTopicFilter() {
		const topicEls = $('[component="category/topic"]');
		const searchTerm = 'test';

		topicEls.each(function () {
			const topicEl = $(this);
			const titleEl = topicEl.find('[component="topic/header"] a');
			const title = titleEl.text().toLowerCase();
			const isMatch = title.indexOf(searchTerm) !== -1;
			console.log(`Title: ${title}\n ${isMatch ? 'Hidden' : 'Visible'}\n`);

			topicEl.toggleClass('hidden', !isMatch);
		});

		const visibleTopics = topicEls.filter(':not(.hidden)');
		if (visibleTopics.length === 0) {
			if ($('[component="category/topic/no-matches"]').length === 0) {
				$('<div component="category/topic/no-matches" class="alert alert-info">No topics match the search term "test".</div>')
					.insertAfter('[component="category/topic"]:last');
			} else {
				$('[component="category/topic/no-matches"]').removeClass('hidden');
			}
		} else {
			$('[component="category/topic/no-matches"]').addClass('hidden');
		}
	}

	// Following format from groupSearch.js, placeholder for future integration with frontend search bar
	function handleTopicSearch() {
		const searchEl = $('[component="category/topic/search"]');
		if (!searchEl.length) {
			return;
		}

		const toggleVisibility = searchEl.parent('[component="category/topic/search-container"]').length > 0;
		const topicEls = $('[component="category/topic"]');

		searchEl.on('show.bs.dropdown', function () {
			function updateList() {
				const val = searchEl.find('input').val().toLowerCase();
				let noMatch = true;
				topicEls.each(function () {
					const topicEl = $(this);
					const title = topicEl.find('.topic-title').text().toLowerCase();
					const isMatch = title.indexOf(val) !== -1;
					if (noMatch && isMatch) {
						noMatch = false;
					}

					topicEl.toggleClass('hidden', !isMatch);
				});

				$('[component="category/topic/no-matches"]').toggleClass('hidden', !noMatch);
			}

			if (toggleVisibility) {
				searchEl.parent().find('.dropdown-toggle').css({ visibility: 'hidden' });
				searchEl.removeClass('hidden');
				searchEl.css({
					'z-index': searchEl.parent().find('.dropdown-toggle').css('z-index') + 1,
				});
			}

			searchEl.on('click', function (ev) {
				ev.preventDefault();
				ev.stopPropagation();
			});
			searchEl.find('input').val('').on('keyup', updateList);
			updateList();
		});

		searchEl.on('shown.bs.dropdown', function () {
			searchEl.find('input').focus();
		});

		searchEl.on('hide.bs.dropdown', function () {
			if (toggleVisibility) {
				searchEl.parent().find('.dropdown-toggle').css({ visibility: 'inherit' });
				searchEl.addClass('hidden');
			}
			searchEl.off('click').find('input').off('keyup');
		});
	}

	Category.toTop = function () {
		navigator.scrollTop(0);
	};

	Category.toBottom = async () => {
		const { count } = await api.get(`/categories/${ajaxify.data.category.cid}/count`);
		navigator.scrollBottom(count - 1);
	};

	function loadTopicsAfter(after, direction, callback) {
		callback = callback || function () {};

		hooks.fire('action:topics.loading');
		const params = utils.params();
		infinitescroll.loadMore(`/categories/${ajaxify.data.cid}/topics`, {
			after: after,
			direction: direction,
			query: params,
			categoryTopicSort: params.sort || config.categoryTopicSort,
		}, function (data, done) {
			hooks.fire('action:topics.loaded', { topics: data.topics });
			callback(data, done);
		});
	}

	return Category;
});
