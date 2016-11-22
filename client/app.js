(function() {
  'use strict';

  angular
    .module('chipOnDuty', ['ngMaterial', 'ngResource', 'ngSanitize', 'ui.router'])
    .constant('ROSLIB', ROSLIB)
    .constant('malarkey', malarkey)
    .config(routerConfig)
    .factory('ros', ros)
    .directive('typewriter', typewriter)
    .run(init)
    .controller('NavigationController', NavigationController)
    .controller('ActivityController', ActivityController);

  function routerConfig($stateProvider, $urlRouterProvider) {
    $stateProvider
      .state('home', {
        url: '/',
        templateUrl: "views/home.html"
      })
      .state('direction', {
        url: '/direction',
        templateUrl: 'views/direction.html',
        controller: 'NavigationController',
        controllerAs: 'app'
      })
      .state('activity', {
        url: '/activity',
        templateUrl: 'views/activity.html',
        controller: 'ActivityController',
        controllerAs: 'app'
      });

    $urlRouterProvider.otherwise('/');
  }

  function ros(ROSLIB, $rootScope) {
    var ros = null;
    var listener = null;
    var publisher = null;
    var listeners = {};
    return {
      connect: function(address) {
        ros = new ROSLIB.Ros({
          url: address
        });
        ros.on('connection', function() {
          listener = new ROSLIB.Topic({
            ros: ros,
            name: '/pyride/node_message',
            messageType: 'pyride_common_msgs/NodeMessage'
          });
          listener.subscribe(function(data) {
            for (var node in listeners) {
              if (listeners.hasOwnProperty(node) && typeof listeners[node] == 'function' && data.node_id == node) {
                $rootScope.$apply(function() {
                  listeners[node](JSON.parse(data.command));
                });
              }
            }
          });
          publisher = new ROSLIB.Topic({
            ros: ros,
            name: '/pyride/node_status',
            messageType: 'pyride_common_msgs/NodeStatus'
          });
        });
        ros.on('close', function() {
          ros = null;
          listener = null;
          publisher = null;
          listeners = {};
        });
      },
      subscribe: function(node, callback) {
        if (!ros || listeners[node]) return;
        listeners[node] = callback;
      },
      unsubscribe: function(topic) {
        if (!ros || listeners[topic]) return;
        delete listeners[topic];
      },
      publish: function(message) {
        var data = new ROSLIB.Message(message);
        publisher.publish(data);
      },
      disconnect: function() {
        if (!ros) return;
        ros.close();
      }
    }
  }

  function typewriter(malarkey) {
    var directive = {
      restrict: 'A',
      scope: {
        value: '@',
        speed: '='
      },
      link: link
    };

    return directive;

    function link(scope, el) {
      el.addClass('typewriter');
      var typewriter = malarkey(el[0], {typeSpeed: scope.speed});
      typewriter.type(scope.value);
    }
  }

  function init($http, ros, $state) {
    $http
      .get('/ros-websocket')
      .then(function(response) {
        ros.connect(response.data.rosbridgeURI);
        ros.subscribe('chip_on_duty_state', function(command) {
          $state.go(command.state);
        });
      });
  }

  function ActivityController($interval, $timeout, $http, $mdDialog, ros) {
    var vm = this;
    vm.activationCode = '';
    vm.activity = null;
    vm.state = null;
    vm.activating = false;
    vm.currentImageIndex = 0;
    vm.cureentSurveyQuestionIndex = 0;
    vm.mobileNumber = '';
    vm.answer = '';
    vm.enterCode = enterCode;
    vm.deleteCode = deleteCode;
    vm.activate = activate;
    vm.setState = setState;
    vm.conductSurvey = conductSurvey;
    vm.answerSurveyQuestion = answerSurveyQuestion;
    vm.isValidMobileNumber = isValidMobileNumber;
    vm.enterNumber = enterNumber;
    vm.deleteNumber = deleteNumber;
    vm.sendOffer = sendOffer;
    vm.endActivity = endActivity;

    function enterCode(char) {
      if (vm.activationCode.length < 6) {
        vm.activationCode += char;
      }
    }

    function deleteCode() {
      if (vm.activationCode.length > 0) {
        vm.activationCode = vm.activationCode.slice(0, -1);
      }
    }

    function activate($event) {
      vm.activating = true;
      $http
        .post('/start-activity', { code: vm.activationCode.toLowerCase() })
        .then(function(response) {
          vm.activity = response.data.activity;
          vm.activating = false;
          setState('demo');
          ros.subscribe('activity_status', function(command) {
            setState(command.status);
          });
          displayImage();
        }, function() {
          vm.activating = false;
          $mdDialog.show(
            $mdDialog
              .alert()
              .clickOutsideToClose(false)
              .title('Invalid activation code')
              .textContent('Please try again')
              .ok('Got it!')
              .targetEvent($event)
          );
        });
    }

    function setState(state) {
      if (state == 'end activity') {
        endActivity();
      } else {
        vm.state = state;
        if (state == 'greet') {
          sendSpeech('Hi, my name is Chip. Would you like to try some ' + vm.activity.product.name + ' from ' + vm.activity.shopkeeper.name + '?');
        }
        if (state == 'present product') {
          sendSpeech('Wonderful! I hope you enjoy it.');
          $timeout(function() {
            setState('ask for survey');
          }, 4000);
        }
        if (state == 'ask for survey') {
          sendSpeech('Would you like to do a simple survey? You will be rewarded with a special offer from ' + vm.activity.shopkeeper.name + '.');
        }
        if (state == 'offer reward') {
          sendSpeech('Thank you for completing the survey. Please enter your mobile phone number to get the special offer.');
        }
        if (state == 'say goodbye') {
          sendSpeech('Great to meet you! Enjoy the rest of your day. See you next time.');
          $timeout(function() {
            setState('demo');
          }, 4000);
        }
      }
    }

    function conductSurvey() {
      setState('conduct survey');
      vm.cureentSurveyQuestionIndex = 0;
      vm.surveyResult = [];
      sendSpeech(vm.activity.survey.surveyItems[vm.cureentSurveyQuestionIndex].question);
    }

    function answerSurveyQuestion(question) {
      $timeout(function() {
        vm.surveyResult.push({
          question: question,
          answer: vm.answer
        });
        vm.cureentSurveyQuestionIndex++;
        vm.answer = '';
        if (vm.cureentSurveyQuestionIndex == vm.activity.survey.surveyItems.length) {
          $http.post('/survey-result', {
            id: vm.activity.id,
            result: vm.surveyResult
          });
          setState('offer reward');
        } else {
          sendSpeech(vm.activity.survey.surveyItems[vm.cureentSurveyQuestionIndex].question);
        }
      }, 300);
    }

    function isValidMobileNumber() {
      var pattern = new RegExp(/^04[0-9]{8}$/);
      return pattern.test(vm.mobileNumber);
    }

    function enterNumber(number) {
      if (vm.mobileNumber.length < 10) {
        vm.mobileNumber += number;
      }
    }

    function deleteNumber() {
      if (vm.mobileNumber.length > 0) {
        vm.mobileNumber = vm.mobileNumber.slice(0, -1);
      }
    }

    function sendOffer() {
      $http.post('/send-offer', {
        id: vm.activity.id,
        mobileNumber: vm.mobileNumber
      });
      vm.mobileNumber = '';
      setState('say goodbye');
    }

    function endActivity() {
      $http.post('/end-activity', { id: vm.activity.id });
      vm.activationCode = '';
      vm.activity = null;
      vm.state = null;
      ros.unsubscribe('activity_status');
    }

    function displayImage() {
      vm.currentImageIndex = 0;
      vm.imageTimer = $interval(function() {
        vm.currentImageIndex++;
        if (vm.currentImageIndex > 3) {
          vm.currentImageIndex = 0;
        }
      }, 3000)
    }

    function sendSpeech(text) {
      ros.publish({
        'node_id': 'chip_on_duty_speech',
        'status_text': text
      });
    }
  }

  function NavigationController(ros) {
    var vm = this;
    vm.currentDestination = null;
    vm.destinations = [
      {
        name: 'Woolworths',
        logo: 'woolworths.png',
        speech: 'Woolworths is on this floor and only about 50m away. Move down the main corridor to my left. It is on the other side. I understand that the avocados are excellent right now.'
      },
      {
        name: 'JB Hi-Fi',
        logo: 'JB-Hi-Fi.png',
        speech: 'JB Hi-Fi is on the 1st floor. Go up the escalator behind me. At the top turn to the left and it is immediately in front of you. Game of Thrones Season 6 DVD is on sale for 41.95 dollars. Personally I don\'t understand the plot but I like Tyrion.'
      },
      {
        name: 'Kmart',
        logo: 'kmart.png',
        speech: 'Kmart is our largest shop by floor space. It is all the way at the end of the centre down the main corridor to my right. You will have to go about 100m so why not stop for refreshments at Gloria Jean’s Coffees.'
      }
    ];
    vm.selectDestination = selectDestination;
    vm.goBack = goBack;

    function selectDestination(index) {
      vm.currentDestination = vm.destinations[index];
      sendSpeech(vm.currentDestination.speech);
    }

    function goBack() {
      vm.currentDestination = null;
    }

    function sendSpeech(text) {
      ros.publish({
        'node_id': 'chip_on_duty_speech',
        'status_text': text
      });
    }
  }

})();