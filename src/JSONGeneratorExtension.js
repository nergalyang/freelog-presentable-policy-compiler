const policy = require('presentable_policy_lang');
const policyListener = policy.policyListener;
let _ = require('underscore');
let initialFlag = false;
let individualFlag = false;
let groupFlag = false;
//排列
permute.permArr = [];
permute.usedChars = [];
function permute(input) {
  let i,
    ch;
  for (i = 0; i < input.length; i++) {
    ch = input.splice(i, 1)[0];
    permute.usedChars.push(ch);
    if (input.length == 0) {
      permute.permArr.push(permute.usedChars.slice());
    }
    permute(input);
    input.splice(i, 0, ch);
    permute.usedChars.pop();
  }
  return permute.permArr
};
//随机的中间态名称
function genRandomStateName(evt1, evt2,evtName) {
  return 'autoGenratedState_'+evt1+'_'+evt2+'_'+evtName+'_'+(new Date * Math.random()).toString(36).substring(0, 4);
};

class JSONGeneratorExtentionClass extends policyListener {
  constructor() {
    super();
    this.errorMsg = null;
    this.policy_segments = [];
  }

  enterP(ctx) {};
  exitP(ctx) {};
  enterStart_hour(ctx) {};
  exitStart_hour(ctx) {};

  enterEnd_hour(ctx) {};
  exitEnd_hour(ctx) {};

  enterSegment(ctx) {
    //对应一个segment
    ctx.segment_block = {
      segmentText : ctx.start.source[0]._input.strdata.slice(ctx.start.start, ctx.stop.stop+1 ),
      initialState : '',
      terminateState : 'terminate',
      users: [],
      states: [],
      all_occured_states: [],
      state_transition_table: []
    };
  };
  exitSegment(ctx) {
      if( ctx.segment_block.activatedStates == [] ||  !ctx.segment_block.activatedStates) {
        this.errorMsg = 'missing activatedStates'
      }
      this.policy_segments.push(ctx.segment_block);
      initialFlag = false;
      individualFlag = false;
      groupFlag = false;
  };
  // 留给下简化版
  // enterSettlement_clause (ctx) {};
  // exitSettlement_clause (ctx) {
  //   //settlement事件
  //   let settlementForward = {
  //     type: 'settlementForward',
  //     params: [3, 'day'],
  //     eventName: 'settlementForward_3_day'
  //   };
  //   let accountSettled = {
  //     type: 'accountSettled',
  //     params: [],
  //     eventName: 'accountSettled'
  //   };
  //   //列出所有token states
  //   let tokenStates = _.reduce( ctx.ID(), (x, y)=> {
  //     return x.concat(y.getText())
  //   }, []);
  //   //获取对应的segment
  //   let segment = this.policy_segments[this.policy_segments.length-1];
  //   //检查tokens staets 是否已经出现,并且暂存一起来，如果pass验证，那么就concat进去了
  //   let tempStates = [];
  //   let statesOccured = _.every(tokenStates, (el)=> {
  //     tempStates.push({
  //       currentState: el,
  //       event: settlementForward,
  //       nextState: 'settlement'
  //     });
  //     tempStates.push({
  //       currentState: 'settlement',
  //       event: accountSettled,
  //       nextState: el
  //     });
  //     return _.contains(segment.all_occured_states, el);
  //   });
  //   // //针对当前segment加入结算事件
  //   if ( statesOccured ) {
  //     Array.prototype.push.apply(this.policy_segments[this.policy_segments.length-1].state_transition_table, tempStates);
  //   }
  // };
  enterUsers(ctx) {
    while ( ctx.parentCtx.constructor.name != 'SegmentContext') {
      ctx.parentCtx =  ctx.parentCtx.parentCtx
    }
    ctx.segment_block = ctx.parentCtx.segment_block;
    //是否手机或者邮箱地址
    let user = ctx.getText();
    let isEmail =   /^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/.test(user);
    let isPhone = /^1[3|4|5|8][0-9]\d{4,8}$/.test(user);
    let isSelf = /self/.test(user.toLowerCase());
    if ( isEmail || isPhone || isSelf ) {
      if( !individualFlag ) {
        individualFlag = true;
        ctx.segment_block.users.push({'userType': 'individual', users:[user]})
      }else {
        ctx.segment_block.users.forEach((obj)=> {
          if (obj.userType == 'individual') {
            obj.users.push(user)
          }
        })
      }
    }else {
      if ( !groupFlag ) {
        groupFlag = true;
        ctx.segment_block.users.push({'userType': 'group', users:[user]})
      }else {
        ctx.segment_block.users.forEach((obj)=> {
          if (obj.userType == 'group') {
            obj.users.push(user)
          }
        })
      }
    }
  };
  exitUsers(ctx) {
    ctx.parentCtx.segment_block = ctx.segment_block;
  };

  enterState_clause(ctx) {
    ctx.segment_block = ctx.parentCtx.segment_block;
  };
  exitState_clause(ctx) {
    ctx.parentCtx.segment_block = ctx.segment_block;
  };

  enterCurrent_state_clause(ctx) {
    ctx.segment_block = ctx.parentCtx.segment_block;
    if ( !initialFlag ) {
      initialFlag = true;
      ctx.segment_block.initialState = ctx.ID().getText()
    }

    ctx.segment_block.states.push(ctx.ID().getText());
    ctx.segment_block.all_occured_states.push(ctx.ID().getText());
    ctx.segment_block.all_occured_states = _.uniq(ctx.segment_block.all_occured_states);
  };
  exitCurrent_state_clause(ctx) {
    ctx.parentCtx.segment_block = ctx.segment_block;
  };

  enterTarget_clause(ctx) {

    ctx.segment_block = ctx.parentCtx.segment_block;

    //重置state
    ctx.current_state = ctx.parentCtx.current_state_clause().ID().getText();
    if(ctx.current_state[0] == '<' && ctx.current_state[ctx.current_state.length-1] == '>') {
      ctx.segment_block.activatedStates = ctx.segment_block.activatedStates || [];
      ctx.segment_block.activatedStates.push(ctx.current_state)
      ctx.segment_block.activatedStates = _.uniq(ctx.segment_block.activatedStates);
    }

    if( ctx.getText().toLowerCase() !== 'terminate') {
      //next_state
      ctx.next_state = ctx.ID().getText();
      //activatedState
      if(ctx.next_state[0] == '<' && ctx.next_state[ctx.next_state.length-1] == '>') {
        ctx.segment_block.activatedStates = ctx.segment_block.activatedStates || [];
        ctx.segment_block.activatedStates.push(ctx.next_state)
        ctx.segment_block.activatedStates = _.uniq(ctx.segment_block.activatedStates);
      }
    }
    //重置event
    ctx.events = [];
  };

  // Exit a parse tree produced by policyParser#target_clause.
  exitTarget_clause(ctx) {
    let state_transition
    if( ctx.events.length >1 ) {
      state_transition = {
        currentState: ctx.current_state,
        event: {
          type : 'compoundEvents',
          params : ctx.events
        },
        nextState: ctx.next_state
      };
    } else {
      state_transition = {
        currentState: ctx.current_state,
        event: ctx.events[0],
        nextState: ctx.next_state
      };
    }
    ctx.segment_block.state_transition_table.push(state_transition);
    // //生成中间状态
    // let tempCurrent = ctx.current_state;
    // //permute当前events
    // _.each(permute(ctx.events), (orderedEvts) => {
    //   tempCurrent = ctx.current_state;
    //   let path = [];
    //   while (orderedEvts.length != 0) {
    //     let event = orderedEvts.pop();
    //     path.push(event.type);
    //     let randomStateName = genRandomStateName(ctx.current_state, ctx.next_state,path.join('-'));
    //     let state_transition = {
    //       currentState: tempCurrent,
    //       event: event,
    //       nextState: ctx.next_state
    //     };
    //     if (orderedEvts.length != 0) {
    //       state_transition.nextState = randomStateName;
    //       tempCurrent = randomStateName;
    //       ctx.segment_block.all_occured_states.push(randomStateName); //记录同一个起始state下面所有的target state及中间state
    //     }
    //     ctx.segment_block.state_transition_table.push(state_transition);
    //   }
    // });
    //记录同一个curren_state 下的多个target
    if ( ctx.next_state ) {
      ctx.segment_block.all_occured_states.push(ctx.next_state);
      ctx.segment_block.all_occured_states = _.uniq(ctx.segment_block.all_occured_states);
    }
    //回传
    ctx.parentCtx.segment_block = ctx.segment_block;
  };

  enterEvent(ctx) {
    ctx.events = ctx.parentCtx.events;
  };
  exitEvent(ctx) {
    ctx.parentCtx.events = ctx.events;
  };

  enterAnd_event(ctx) {
    ctx.events = ctx.parentCtx.events;
  };
  exitAnd_event(ctx) {
    ctx.parentCtx.events = ctx.events;
  };
  enterPeriod_event (ctx) {
    let timeUnit = ctx.time_unit().getText();
    ctx.events = ctx.parentCtx.events;
    ctx.events.push({
      type: 'period',
      params: [timeUnit],
      eventName: 'period_'+timeUnit+ '_event'
    });
  };
  exitPeriod_event (ctx) {
    ctx.parentCtx.events = ctx.events;
  };
  enterSpecific_date_event (ctx) {
    let date = ctx.DATE().getText();
    ctx.events = ctx.parentCtx.events;
    ctx.events.push({
      type: 'arrivalDate',
      params: [1, date],
      eventName: 'arrivalDate_1_'+date+'_event'
    });
  };
  exitSpecific_date_event  (ctx) {
    ctx.parentCtx.events = ctx.events;
  };
  enterRelative_date_event (ctx) {
    let day = Number(ctx.INT().getText());
    let unit = ctx.time_unit().getText();
    ctx.events = ctx.parentCtx.events;
    ctx.events.push({
      type: 'arrivalDate',
      params: [0, day, unit],
      eventName: 'arrivalDate_0_'+day +'_'+unit+'_event'
    });
  };
  exitRelative_date_event (ctx) {
    ctx.parentCtx.events = ctx.events;
  };
  enterPricing_agreement_event(ctx) {
    ctx.events = ctx.parentCtx.events;
    ctx.events.push({
      type: 'pricingAgreement',
      params:[tbd],
      eventName: 'pricingAgreement'
    });
  };
  exitPricing_agreement_event(ctx) {
    ctx.parentCtx.events = ctx.events;
  };

  enterTransaction_event(ctx) {
    let transactionAmount = Number(ctx.INTEGER_NUMBER().getText());
    let account_id = ctx.FEATHERACCOUNT().getText();


    ctx.events = ctx.parentCtx.events;
    ctx.events.push({
      type: 'transaction',
      params: [account_id, transactionAmount],
      eventName: 'transaction_'+account_id+'_'+transactionAmount+'_event'
    });
  };
  exitTransaction_event(ctx) {
    ctx.parentCtx.events = ctx.events;
  };

  enterSigning_event(ctx) {
    ctx.events = ctx.parentCtx.events;
    let tempLicenseIds = [];
    _.each( ctx.license_resource_id(), (licensId)=>{
      tempLicenseIds.push(licensId.getText());
    });
    ctx.events.push({
      type: 'signing',
      params: tempLicenseIds,
      eventName: 'signing_'+tempLicenseIds.join('_')
    });
  };
  exitSigning_event(ctx) {
    ctx.parentCtx.events = ctx.events;
  };

  enterGuaranty_event(ctx) {
    ctx.events = ctx.parentCtx.events;
  };
  exitGuaranty_event(ctx) {
    ctx.parentCtx.events = ctx.events;
  };

  enterContract_guaranty(ctx) {
    let amount = ctx.INT()[0].getText();
    let day = ctx.INT()[1].getText();
    ctx.events = ctx.parentCtx.events;
    ctx.events.push({
      type: 'contractGuaranty',
      params: [ amount, day, 'day'],
      eventName: 'contractGuaranty_'+amount +'_'+day+'_event'
    });
  };
  exitContract_guaranty(ctx) {
    ctx.parentCtx.events = ctx.events;
  };

  enterPlatform_guaranty(ctx) {
    ctx.events = ctx.parentCtx.events;
    ctx.events.push({
      type: 'platformGuaranty',
      params: [Number(ctx.INT().getText())],
      eventName: 'platformGuaranty'
    });
  };
  exitPlatform_guaranty(ctx) {
    ctx.parentCtx.events = ctx.events;
  };

  enterSettlement_event(ctx) {
    ctx.events = ctx.parentCtx.events;
    ctx.events.push({
      type: 'accountSettled',
      params:[]
    });
  };
  exitSettlement_event(ctx) {
    ctx.parentCtx.events = ctx.events;
  };

  enterAccess_count_event(ctx) {
    ctx.events = ctx.parentCtx.events;
  };
  exitAccess_count_event(ctx) {
    ctx.parentCtx.events = ctx.events;
  };

  enterVisit_increment_event(ctx) {
    ctx.events = ctx.parentCtx.events;
    ctx.events.push({
      type: 'accessCountIncrement',
      params: [Number(ctx.INT().getText())]
    });
  };

  // Exit a parse tree produced by policyParser#visit_increment_event.
  exitVisit_increment_event(ctx) {
    ctx.parentCtx.events = ctx.events;
  };

  enterVisit_event(ctx) {
    ctx.events = ctx.parentCtx.events;
    ctx.events.push({
      type: 'accessCount',
      params: [Number(ctx.INT().getText())]
    });
  };
  exitVisit_event(ctx) {
    ctx.parentCtx.events = ctx.events;
  };

  enterBalance_event(ctx) {
    ctx.events = ctx.parentCtx.events;
  };
  exitBalance_event(ctx) {
    ctx.parentCtx.events = ctx.events;
  };

  // Enter a parse tree produced by policyParser#balance_greater.
  enterBalance_greater(ctx) {
    ctx.events = ctx.parentCtx.events;
    ctx.events.push({type: 'balance_smaller_event', params: ctx.getText()});
  };
  exitBalance_greater(ctx) {
    ctx.parentCtx.events = ctx.events;
  };

  enterBalance_smaller(ctx) {
    ctx.events = ctx.parentCtx.events;
    ctx.events.push({type: 'balance_greater_event', params: ctx.getText()});
  };
  exitBalance_smaller(ctx) {
    ctx.parentCtx.events = ctx.events;
  };

  enterTime_unit(ctx) {};
  exitTime_unit(ctx) {};

  enterState(ctx) {};
  exitState(ctx) {};

  enterLicense_resource_id(ctx) {};
  exitLicense_resource_id(ctx) {};

  enterUser_individual(ctx) {
    // //直接挂载到Audience_clauseContext 上面，所以不需要回传了
    // while ( ctx.parentCtx.constructor.name != 'SegmentContext') {
    //   ctx.parentCtx =  ctx.parentCtx.parentCtx
    // }
    // ctx.segment_block = ctx.parentCtx.segment_block;
    //
    // let hasIndividual;
    // ctx.segment_block.users.forEach((obj)=> {
    //   if( obj.userType == 'individual') {
    //     hasIndividual = true;
    //       obj.users.push(ctx.getText());
    //   }
    // })
    // if ( !hasIndividual ) {
    //     ctx.segment_block.users.push({userType:'individual', users:[ctx.getText()]})
    // }

  };
  exitUser_individual(ctx) {
  }

  enterUser_groups(ctx) {
    //继承
    ctx.userObj = ctx.parentCtx.userObj;
    //新增users
    ctx.userObj.users = ctx.userObj.users || [];
    for (var i = 0; i < ctx.getChildCount(); i++) {
      if (ctx.getChild(i).getText() != ',') {
        ctx.userObj.users.push(ctx.getChild(i).getText());
      }
    }
  };
  exitUser_groups(ctx) {
    //回传
    ctx.parentCtx.userObj = ctx.userObj;
  };

};

module.exports = JSONGeneratorExtentionClass;
