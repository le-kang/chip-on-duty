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
      sendSpeech: function(speech) {
        var message = new ROSLIB.Message({
          'node_id': 'chip_on_duty_speech',
          'status_text': speech
        });
        console.log(message);
        publisher.publish(message);
      },
      sendMotion: function(motion) {
        var message = new ROSLIB.Message({
          'node_id': 'chip_on_duty_motion',
          'status_text': motion
        });
        console.log(message);
        publisher.publish(message);
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
          ros.sendSpeech(',I have downloaded product and survey information.');
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
          ros.sendSpeech(',Hi, my name is Chip. Would you like to try some ' + vm.activity.product.name + ' from ' + vm.activity.shopkeeper.name + '?');
          ros.sendMotion('point_to_left');
        }
        if (state == 'present product') {
          ros.sendSpeech(',Wonderful! I hope you enjoy it.');
          $timeout(function() {
            setState('ask for survey');
          }, 5000);
        }
        if (state == 'ask for survey') {
          ros.sendSpeech(',Would you like to do a simple survey?');
          ros.sendMotion('show_touchscreen');
        }
        if (state == 'offer reward') {
          ros.sendSpeech(',Thank you for completing the survey. Please enter your mobile phone number to get the special offer.');
        }
        if (state == 'say goodbye') {
          ros.sendSpeech(',Thank you, It is great to meet you! Enjoy the rest of your day. See you next time.');
          ros.sendMotion('bow');
          $timeout(function() {
            setState('demo');
          }, 7000);
        }
      }
    }

    function conductSurvey() {
      setState('conduct survey');
      vm.cureentSurveyQuestionIndex = 0;
      vm.surveyResult = [];
      ros.sendSpeech(',' + vm.activity.survey.surveyItems[vm.cureentSurveyQuestionIndex].question);
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
          setState('say goodbye');
        } else {
          ros.sendSpeech(',' + vm.activity.survey.surveyItems[vm.cureentSurveyQuestionIndex].question);
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
      ros.sendSpeech(',That completes the product sample survey. I\'m collating results and sending a link to the shop owner. You can see the results on the screen.');
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
  }

  function NavigationController(ros, $timeout) {
    var vm = this;
    vm.currentDestination = null;
    vm.destinations = [
      {
        name: 'Customer Care',
        logo: 'customer_care.png',
        map: 'customer_care.png',
        description: 'Our customer care desk is located behind me, next to the travelator. You can do loads of things at our customer care desk!  Grab a gift card for that special someone or pick up a copy of our Christmas Gift Guide for some inspiration. Do you need a hand around the centre? You can hire mobility equipment there as well.',
        speech: 'Our customer care desk is located behind me, next to the travelator. You can do loads of things at our customer care desk!  Grab a gift card for that special someone, or pick up a copy of our Christmas Gift Guide for some inspiration. Do you need a hand around the centre? You can hire mobility equipment there as well.',
        motionDelay: 0,
        motion: 'point_to_right'
      },
      {
        name: 'Big W',
        logo: 'bigw.png',
        map: 'bigw.png',
        description: 'Big W is located on the level above. Take the travelator next to our customer care desk, then turn left and walk towards to the end, Big W is there next to The Coffee Club. Have you had a photo with Santa? He’s located outside Big W, why not do it while you are there. Have you put up your Christmas Tree? Big W has a huge range of Christmas trees, decorations and lights.',
        speech: 'Big W is located on the level above. Take the travelator next to our customer care desk, then turn left and walk towards to the end, Big W is there next to The Coffee Club. Have you had a photo with Santa? He’s located outside Big W, why not do it while you are there. Have you put up your Christmas Tree? Big W has a huge range of Christmas trees, decorations and lights.',
        motionDelay: 0,
        motion: 'point_to_top_left'
      },
      {
        name: 'Sportsgirl',
        logo: 'sportsgirl.png',
        map: 'sportsgirl.png',
        description: 'Sportsgirl is located on the level above. Head up the travelator and walk to your left. They are in between Napoleon Perdis and Bardot. Sportsgirl is a brand new retailer at Merrylands. This is their first day of trade! Pay them a visit and show them some love.',
        speech: 'Sports girl is located on the level above. Head up the travelator and walk to your left. They are in between Napoleon Perdeis and Bardou. Sports girl is a brand new retailer at Merry lands. This is their first day of trade! Pay them a visit, and show them some love.',
        motionDelay: 0,
        motion: 'point_to_top_left'
      },
      {
        name: 'Priceline',
        logo: 'priceline.png',
        map: 'priceline.png',
        description: 'It’s a bit of a walk but it’s worth it. Priceline is on this level, keep walking straight down this corridor and it’s on the left. If you get to Kmart you have gone too far. They have so many Christmas hampers, already packed – all you need to do is wrap them. Up to 60% off this Wednesday and Thursday on Fragrance.',
        speech: 'It’s a bit of a walk but it’s worth it. Price line is on this level, keep walking straight down this corridor, and it’s on the left. If you get to K mart, you have gone too far. They have so many Christmas hampers, already packed, all you need to do is wrap them. Up to 60% off this Wednesday and Thursday on Fragrance.',
        motionDelay: 2,
        motion: 'point_to_right'
      },
      {
        name: 'Food Court',
        logo: 'food_court.png',
        map: 'food_court.png',
        description: 'Our food court is located on the level above. Take the travelators near Customer Care, turn right and walk straight. The food court will be on your left – you can’t miss it. Treat yourself! Head to Krema Bar for a coffee and muffin deal, you deserve it.',
        speech: 'Our food court is located on the level above. Take the travelators near Customer Care, turn right and walk straight. The food court will be on your left,you can’t miss it. Treat yourself! Head to Krema Bar for a coffee and muffin deal, you deserve it.',
        motionDelay: 0,
        motion: 'point_to_top_right'
      },
      {
        name: 'JB Hi-Fi',
        logo: 'jb-hi-fi.png',
        map: 'jb-hi-fi.png',
        description: 'JB Hi-Fi is located on the floor above us. Head up the travelators near Customer Care, you will see the shopfront straight ahead. Do you know someone who likes their music loud? They have a huge range of Bluetooth speakers for Christmas. Or maybe you want to give them some headphones?',
        speech: 'JB Hi-Fie is located on the floor above us. Head up the travelators near Customer Care, you will see the shopfront straight ahead. Do you know someone who likes their music loud? They have a huge range of Bluetooth speakers for Christmas. Or maybe you want to give them some headphones?',
        motionDelay: 0,
        motion: 'point_to_top_right'
      }
    ];
    vm.selectDestination = selectDestination;
    vm.goBack = goBack;

    function selectDestination(index) {
      vm.currentDestination = vm.destinations[index];
      ros.sendSpeech(',' + vm.currentDestination.speech);
      $timeout(function () {
        ros.sendMotion(vm.currentDestination.motion);
      }, vm.currentDestination.motionDelay);
    }

    function goBack() {
      vm.currentDestination = null;
    }
  }

})();