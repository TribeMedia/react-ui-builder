'use strict';

var React = require('react/addons');
var _ = require('lodash');
var Server = require('../../api/Server.js');
var DeskPageFrameStore = require('../../store/desk/DeskPageFrameStore.js');
var DeskPageFrameActions = require('../../action/desk/DeskPageFrameActions.js');
var FormMixin = require('../application/FormMixin.js');

var Repository = require('../../api/Repository.js');
var Common = require('../../api/Common.js');

var DeskPageFrame = React.createClass({
    mixins: [FormMixin],

    getInitialState: function(){
        return Repository.getCurrentPageModel();
    },

    render: function() {
        return (<iframe {...this.props} />);
    },

    componentDidMount: function() {
        //this._hideModalProgress();
        this.unsubscribe = DeskPageFrameStore.listen(this._changeFrameContent);
        //
        var domNode = React.findDOMNode(this);
        domNode.onload = (function(){
            //console.log('IFrame is loaded and ready');
            this._renderFrameContent();
        }).bind(this);
        //
        Server.onSocketEmit('compilerWatcher.errors', function(data){
            var messages = [];
            _.each(data, function(item){
                _.each(item, function(message){
                    messages.push(message);
                });
            });
            this._showModalMessageArray(messages);
            //console.error(JSON.stringify(data, null, 4));
        }.bind(this));
        Server.onSocketEmit('compilerWatcher.success', function(data){
            //this._hideModalProgress();
            //this._showModalProgress('Please wait. Loading page...', 0);
            if(data.compiledProcessCount >= 1){
                if(domNode.contentDocument && domNode.contentDocument.documentElement){
                    this.contentScrollTop = domNode.contentDocument.documentElement.scrollTop;
                }
                domNode.src = Repository.getHtmlForDesk();
            }
        }.bind(this));
        //
    },

    componentWillUnmount: function(){
        this.unsubscribe();
        if(this.frameEndpoint) {
            this.frameEndpoint.onComponentDidUpdate = null;
            this.frameEndpoint.onComponentWillUpdate = null;
            this.frameEndpoint  = null;
        }
    },

    _renderFrameContent: function() {
        //this._showModalProgress('Please wait. Loading page...', 400);
        var domNode = React.findDOMNode(this);
        var doc = domNode.contentDocument;
        var win = domNode.contentWindow;
        if(doc.readyState === 'complete' && win.endpoint && win.endpoint.Page) {

            //console.log('Page is loaded...');

            Repository.setCurrentPageDocument(doc);
            Repository.setCurrentPageWindow(win);

            //var cssList = Common.getCSSClasses(doc);
            //console.log(JSON.stringify(cssList, null, 4));

            this.frameEndpoint = win.endpoint;
            this.frameEndpoint.onComponentDidUpdate = function(){
                this._mapDomNodes();
            }.bind(this);
            this.frameEndpoint.onComponentWillUpdate = function(){
                DeskPageFrameActions.deselectComponent();
            };
            this._changeFrameContent();

            this._hideModalProgress();

            if(this.contentScrollTop){
                doc.documentElement.scrollTop = this.contentScrollTop;
            }
        }
    },

    _changeFrameContent: function(){
        if(this.frameEndpoint){
            React.addons.TestUtils.findAllInRenderedTree(this.frameEndpoint.Page,
                function(component){
                    var props = component.props;
                    if(props && props['data-umyid'] && props['data-umyid'].length > 0){
                        var domNode = this.frameEndpoint.Page.findDOMNodeInPage(component);
                        if(domNode){
                            $(domNode).off("mousedown.umy");
                        }
                    }
                    return true;
                }.bind(this)
            );
            var pageModel = Repository.getCurrentPageModel();
            this.frameEndpoint.replaceState(pageModel);
            //if(this.frameEndpoint.renderPageToString){
            //    //console.log(this.state.pageName);
            //    console.log(this.frameEndpoint.renderPageToString(pageModel));
            //}
        }
    },

    _mapDomNodes: function(){
        Repository.resetCurrentPageDomNodes();
        React.addons.TestUtils.findAllInRenderedTree(this.frameEndpoint.Page,
            function(component){
                var props = component.props;
                //console.log(props);
                if(props && props['data-umyid'] && props['data-umyid'].length > 0){
                    var dataumyid = props['data-umyid'];
                    var existingPageNode = Repository.getCurrentPageDomNode(dataumyid);
                    if(existingPageNode && !existingPageNode.domElement){
                        var domNode = this.frameEndpoint.Page.findDOMNodeInPage(component);
                        if(domNode){
                            Repository.setCurrentPageDomNode(dataumyid, domNode);
                            $(domNode).on("mousedown.umy", (function(_dataumyid){
                                return function(e){
                                    if(!e.metaKey && !e.ctrlKey){
                                        e.stopPropagation();
                                        e.preventDefault();
                                        //console.log(e.metaKey);
                                        DeskPageFrameActions.deselectComponent();
                                        DeskPageFrameActions.selectComponentById(_dataumyid);
                                    }
                                };
                            })(dataumyid));
                            //console.log("Set domNode into Repository: %o, %o", dataumyid, component.getDOMNode());
                        }
                    }
                }
                return true;
            }.bind(this)
        );
        DeskPageFrameActions.didRenderPageFrame();
    }


});

module.exports = DeskPageFrame;
