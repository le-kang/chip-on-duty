(function() {
  'use strict';

  angular
    .module('chipOnDuty', ['ngMaterial', 'ngResource', 'ngSanitize'])
    .constant('ROSLIB', ROSLIB)
    .controller('AppController', AppController);

  function AppController($interval, $timeout, $http, $mdDialog) {
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
          vm.state = 'demo';
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
      vm.state = state;
    }

    function conductSurvey() {
      vm.state = 'conduct survey';
      vm.cureentSurveyQuestionIndex = 0;
      vm.surveyResult = [];
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
          vm.state = 'offer reward';
        }
      }, 200);
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
      vm.mobileNumber = '';
      vm.state = 'say goodbye';
    }

    function endActivity() {
      $http
        .post('/end-activity', { id: vm.activity.id })
        .then(function() {
          vm.activationCode = '';
          vm.activity = null;
          vm.state = null;
        });
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

})();